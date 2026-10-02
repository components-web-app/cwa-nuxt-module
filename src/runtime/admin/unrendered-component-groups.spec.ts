// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, defineComponent, nextTick, reactive } from 'vue'
import { mount } from '@vue/test-utils'
import { mergeComponentGroup, useUnrenderedComponentGroups, UNRENDERED_SETTLE_MS } from './unrendered-component-groups'
import * as cwaComposable from '#cwa/composables/cwa'

type StoredResource = { data: Record<string, any> }

const store = reactive<Record<string, StoredResource>>({})
const mounted = reactive(new Set<string>())
const state = reactive({
  isLoading: false,
  isAdmin: true,
  pages: ['/_/pages/home'] as string[],
  layout: '/_/layouts/main' as string | undefined,
})

const updateResource = vi.fn()
const deleteResource = vi.fn()

function orderedPositions(groupIri: string) {
  const positions: string[] | undefined = store[groupIri]?.data.componentPositions
  if (!positions) {
    return
  }
  return positions
    .filter(iri => store[iri])
    .sort((a, b) => (store[a]!.data.sortValue ?? 0) - (store[b]!.data.sortValue ?? 0))
}

const $cwa = {
  auth: { isAdmin: computed(() => state.isAdmin) },
  admin: { isComponentGroupMounted: (iri: string) => mounted.has(iri) },
  resources: {
    isLoading: computed(() => state.isLoading),
    displayPageIri: computed(() => state.pages[0]),
    get depthCount() {
      return computed(() => state.pages.length)
    },
    get layout() {
      return computed(() => (state.layout ? store[state.layout] : undefined))
    },
    pageAtDepth: (depth: number) => computed(() => {
      const iri = state.pages[depth]
      return iri ? store[iri] : undefined
    }),
    getResource: (iri: string) => computed(() => store[iri]),
    getOrderedPositionsForGroup: vi.fn((iri: string, _includeNew?: boolean) => orderedPositions(iri)),
    findAllPublishableIris: (iri: string) => {
      const related = store[iri]?.data.publishedResource
      return related ? [iri, related] : [iri]
    },
  },
  resourcesManager: { updateResource, deleteResource },
}

function put(iri: string, data: Record<string, any> = {}) {
  store[iri] = { data: { '@id': iri, '_metadata': { persisted: true }, ...data } }
}

function group(iri: string, reference: string, location: string, positions: string[] = []) {
  put(iri, { '@type': 'ComponentGroup', 'reference': `${reference}_${location}`, location, 'componentPositions': positions })
}

function position(iri: string, groupIri: string, sortValue: number, component?: string, extra: Record<string, any> = {}) {
  put(iri, { '@type': 'ComponentPosition', 'componentGroup': groupIri, sortValue, component, ...extra })
}

function mountDetector() {
  let result!: ReturnType<typeof useUnrenderedComponentGroups>
  const wrapper = mount(defineComponent({
    setup() {
      result = useUnrenderedComponentGroups()
      return () => null
    },
  }))
  return { wrapper, result }
}

async function settle() {
  await nextTick()
  vi.advanceTimersByTime(UNRENDERED_SETTLE_MS)
  await nextTick()
}

function homePageWithGroups(groups: string[]) {
  put('/_/pages/home', { '@type': 'Page', 'componentGroups': groups })
}

describe('useUnrenderedComponentGroups', () => {
  let wrapper: ReturnType<typeof mount> | undefined

  beforeEach(() => {
    vi.useFakeTimers()
    // @ts-expect-error partial Cwa
    vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => $cwa)
    put('/_/layouts/main', { '@type': 'Layout', 'componentGroups': [] })
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    for (const key of Object.keys(store)) {
      delete store[key]
    }
    mounted.clear()
    state.isLoading = false
    state.isAdmin = true
    state.pages = ['/_/pages/home']
    state.layout = '/_/layouts/main'
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  test('lists an attached group that nothing mounted, and the mounted one as a rendered target', async () => {
    homePageWithGroups(['/_/component_groups/hero', '/_/component_groups/top'])
    group('/_/component_groups/hero', 'hero', '/_/pages/home')
    group('/_/component_groups/top', 'top', '/_/pages/home')
    mounted.add('/_/component_groups/hero')
    const detector = mountDetector()
    wrapper = detector.wrapper
    await settle()
    expect(detector.result.unrendered.value.map(g => g.iri)).toEqual(['/_/component_groups/top'])
    expect(detector.result.unrendered.value[0]).toMatchObject({ reference: 'top', fromLayout: false })
    expect(detector.result.rendered.value).toEqual([{ iri: '/_/component_groups/hero', reference: 'hero' }])
    expect(detector.result.warningCount.value).toBe(1)
  })

  test('reports nothing until the page has stopped loading for the settle time', async () => {
    homePageWithGroups(['/_/component_groups/top'])
    group('/_/component_groups/top', 'top', '/_/pages/home')
    state.isLoading = true
    const detector = mountDetector()
    wrapper = detector.wrapper
    await settle()
    expect(detector.result.unrendered.value).toEqual([])
    expect(detector.result.warningCount.value).toBe(0)

    state.isLoading = false
    await nextTick()
    vi.advanceTimersByTime(UNRENDERED_SETTLE_MS - 1)
    await nextTick()
    expect(detector.result.unrendered.value).toEqual([])

    vi.advanceTimersByTime(1)
    await nextTick()
    expect(detector.result.unrendered.value.map(g => g.iri)).toEqual(['/_/component_groups/top'])
  })

  test('clears the report as soon as a new load starts', async () => {
    homePageWithGroups(['/_/component_groups/top'])
    group('/_/component_groups/top', 'top', '/_/pages/home')
    const detector = mountDetector()
    wrapper = detector.wrapper
    await settle()
    expect(detector.result.unrendered.value).toHaveLength(1)
    state.isLoading = true
    await nextTick()
    expect(detector.result.unrendered.value).toEqual([])
  })

  test('a group that mounts late, after the settle time, drops out of the report', async () => {
    homePageWithGroups(['/_/component_groups/lazy'])
    group('/_/component_groups/lazy', 'lazy', '/_/pages/home')
    const detector = mountDetector()
    wrapper = detector.wrapper
    await settle()
    expect(detector.result.unrendered.value).toHaveLength(1)
    mounted.add('/_/component_groups/lazy')
    await nextTick()
    expect(detector.result.unrendered.value).toEqual([])
  })

  test('finds a component-owned group through the published version of a rendered draft component', async () => {
    homePageWithGroups(['/_/component_groups/hero'])
    group('/_/component_groups/hero', 'hero', '/_/pages/home', ['/_/component_positions/p1'])
    position('/_/component_positions/p1', '/_/component_groups/hero', 0, '/component/tabs/draft')
    put('/component/tabs/draft', { '@type': 'Tabs', 'publishedResource': '/component/tabs/live' })
    put('/component/tabs/live', { '@type': 'Tabs', 'componentGroups': ['/_/component_groups/tab-old'] })
    group('/_/component_groups/tab-old', 'tab_old', '/component/tabs/live')
    mounted.add('/_/component_groups/hero')
    const detector = mountDetector()
    wrapper = detector.wrapper
    await settle()
    expect(detector.result.unrendered.value.map(g => g.iri)).toEqual(['/_/component_groups/tab-old'])
    expect(detector.result.unrendered.value[0]!.reference).toBe('tab_old')
  })

  test('does not separately list groups owned by components inside a group that is itself unrendered', async () => {
    homePageWithGroups(['/_/component_groups/top'])
    group('/_/component_groups/top', 'top', '/_/pages/home', ['/_/component_positions/p1'])
    position('/_/component_positions/p1', '/_/component_groups/top', 0, '/component/tabs/1')
    put('/component/tabs/1', { '@type': 'Tabs', 'componentGroups': ['/_/component_groups/inner'] })
    group('/_/component_groups/inner', 'inner', '/component/tabs/1')
    const detector = mountDetector()
    wrapper = detector.wrapper
    await settle()
    expect(detector.result.unrendered.value.map(g => g.iri)).toEqual(['/_/component_groups/top'])
  })

  test('labels an unrendered layout group and leaves it out of the warning count', async () => {
    homePageWithGroups([])
    put('/_/layouts/main', { '@type': 'Layout', 'componentGroups': ['/_/component_groups/footer', '/_/component_groups/nav'] })
    group('/_/component_groups/footer', 'footer', '/_/layouts/main')
    group('/_/component_groups/nav', 'nav', '/_/layouts/main')
    mounted.add('/_/component_groups/nav')
    const detector = mountDetector()
    wrapper = detector.wrapper
    await settle()
    expect(detector.result.unrendered.value).toEqual([expect.objectContaining({ iri: '/_/component_groups/footer', fromLayout: true })])
    expect(detector.result.warningCount.value).toBe(0)
    expect(detector.result.rendered.value.map(g => g.iri)).toEqual(['/_/component_groups/nav'])
  })

  test('a group reachable from both the page and the layout counts as the page\'s', async () => {
    homePageWithGroups(['/_/component_groups/shared'])
    put('/_/layouts/main', { '@type': 'Layout', 'componentGroups': ['/_/component_groups/shared'] })
    group('/_/component_groups/shared', 'shared', '/_/pages/home')
    const detector = mountDetector()
    wrapper = detector.wrapper
    await settle()
    expect(detector.result.unrendered.value).toEqual([expect.objectContaining({ iri: '/_/component_groups/shared', fromLayout: false })])
    expect(detector.result.warningCount.value).toBe(1)
  })

  test('checks the page at every nested depth', async () => {
    state.pages = ['/_/pages/parent', '/_/pages/child']
    put('/_/pages/parent', { '@type': 'Page', 'componentGroups': ['/_/component_groups/parent-main'] })
    put('/_/pages/child', { '@type': 'Page', 'componentGroups': ['/_/component_groups/child-old'] })
    group('/_/component_groups/parent-main', 'main', '/_/pages/parent')
    group('/_/component_groups/child-old', 'old', '/_/pages/child')
    mounted.add('/_/component_groups/parent-main')
    const detector = mountDetector()
    wrapper = detector.wrapper
    await settle()
    expect(detector.result.unrendered.value.map(g => g.iri)).toEqual(['/_/component_groups/child-old'])
  })

  test('lists each unrendered group\'s positions in order with their component type, including dynamic positions', async () => {
    homePageWithGroups(['/_/component_groups/top'])
    group('/_/component_groups/top', 'top', '/_/pages/home', ['/_/component_positions/b', '/_/component_positions/a', '/_/component_positions/dyn'])
    position('/_/component_positions/a', '/_/component_groups/top', 0, '/component/html/1')
    position('/_/component_positions/b', '/_/component_groups/top', 1, '/component/image/1')
    position('/_/component_positions/dyn', '/_/component_groups/top', 2, undefined, { pageDataProperty: 'heroImage' })
    put('/component/html/1', { '@type': 'HtmlContent' })
    put('/component/image/1', { '@type': 'Image' })
    const detector = mountDetector()
    wrapper = detector.wrapper
    await settle()
    expect(detector.result.unrendered.value[0]!.positions).toEqual([
      { iri: '/_/component_positions/a', component: '/component/html/1', componentType: 'HtmlContent', pageDataProperty: undefined },
      { iri: '/_/component_positions/b', component: '/component/image/1', componentType: 'Image', pageDataProperty: undefined },
      { iri: '/_/component_positions/dyn', component: undefined, componentType: undefined, pageDataProperty: 'heroImage' },
    ])
  })

  test('skips attached groups that are not in the store', async () => {
    homePageWithGroups(['/_/component_groups/deleted'])
    const detector = mountDetector()
    wrapper = detector.wrapper
    await settle()
    expect(detector.result.unrendered.value).toEqual([])
  })

  test('reports nothing to a non-admin', async () => {
    state.isAdmin = false
    homePageWithGroups(['/_/component_groups/top'])
    group('/_/component_groups/top', 'top', '/_/pages/home')
    const detector = mountDetector()
    wrapper = detector.wrapper
    await settle()
    expect(detector.result.unrendered.value).toEqual([])
    expect(detector.result.warningCount.value).toBe(0)
  })
})

describe('mergeComponentGroup', () => {
  beforeEach(() => {
    updateResource.mockImplementation(async ({ endpoint }: { endpoint: string }) => ({ '@id': endpoint }))
    deleteResource.mockImplementation(async ({ endpoint }: { endpoint: string }) => {
      delete store[endpoint]
    })
  })

  afterEach(() => {
    for (const key of Object.keys(store)) {
      delete store[key]
    }
    updateResource.mockReset()
    deleteResource.mockReset()
  })

  function sourceAndTarget(targetSortValues: number[]) {
    const targetPositions = targetSortValues.map((_, index) => `/_/component_positions/t${index}`)
    group('/_/component_groups/hero', 'hero', '/_/pages/home', targetPositions)
    targetSortValues.forEach((sortValue, index) => position(`/_/component_positions/t${index}`, '/_/component_groups/hero', sortValue, `/component/x/t${index}`))
    group('/_/component_groups/top', 'top', '/_/pages/home', ['/_/component_positions/s-late', '/_/component_positions/s-early'])
    position('/_/component_positions/s-late', '/_/component_groups/top', 7, '/component/x/late')
    position('/_/component_positions/s-early', '/_/component_groups/top', 2, '/component/x/early')
  }

  test('moves every position to the end of the target in the source order, then deletes the emptied source without asking again', async () => {
    sourceAndTarget([0, 1, 2])
    const result = await mergeComponentGroup($cwa as any, '/_/component_groups/top', '/_/component_groups/hero')
    expect(updateResource.mock.calls.map(([event]) => [event.endpoint, event.data])).toEqual([
      ['/_/component_positions/s-early', { componentGroup: '/_/component_groups/hero', sortValue: 3 }],
      ['/_/component_positions/s-late', { componentGroup: '/_/component_groups/hero', sortValue: 4 }],
    ])
    expect(updateResource.mock.calls[0]![0].refreshEndpoints).toEqual(['/_/component_groups/hero', '/_/component_groups/top'])
    expect(deleteResource).toHaveBeenCalledTimes(1)
    expect(deleteResource).toHaveBeenCalledWith({ endpoint: '/_/component_groups/top' }, true)
    expect(deleteResource.mock.invocationCallOrder[0]).toBeGreaterThan(updateResource.mock.invocationCallOrder[1]!)
    expect(result).toEqual({ failed: [], sourceDeleted: true })
  })

  test('places the first move past every value the API can renumber the target to, even with duplicate sort values', async () => {
    sourceAndTarget([4, 4, 5])
    await mergeComponentGroup($cwa as any, '/_/component_groups/top', '/_/component_groups/hero')
    expect(updateResource.mock.calls.map(([event]) => event.data.sortValue)).toEqual([7, 8])
  })

  test('places the first move past the highest sort value when the target has gaps', async () => {
    sourceAndTarget([0, 10])
    await mergeComponentGroup($cwa as any, '/_/component_groups/top', '/_/component_groups/hero')
    expect(updateResource.mock.calls.map(([event]) => event.data.sortValue)).toEqual([11, 12])
  })

  test('starts an empty target at zero', async () => {
    sourceAndTarget([])
    await mergeComponentGroup($cwa as any, '/_/component_groups/top', '/_/component_groups/hero')
    expect(updateResource.mock.calls.map(([event]) => event.data.sortValue)).toEqual([0, 1])
  })

  test('keeps the source group and reports the position when a move fails, still moving the rest in order', async () => {
    sourceAndTarget([0])
    updateResource.mockImplementationOnce(async () => undefined)
    const result = await mergeComponentGroup($cwa as any, '/_/component_groups/top', '/_/component_groups/hero')
    expect(updateResource.mock.calls.map(([event]) => [event.endpoint, event.data.sortValue])).toEqual([
      ['/_/component_positions/s-early', 1],
      ['/_/component_positions/s-late', 1],
    ])
    expect(deleteResource).not.toHaveBeenCalled()
    expect(result).toEqual({ failed: ['/_/component_positions/s-early'], sourceDeleted: false })
  })

  test('reports the source as not deleted when its DELETE fails', async () => {
    sourceAndTarget([0])
    deleteResource.mockImplementationOnce(async () => undefined)
    const result = await mergeComponentGroup($cwa as any, '/_/component_groups/top', '/_/component_groups/hero')
    expect(result).toEqual({ failed: [], sourceDeleted: false })
  })

  test('never merges a group into itself', async () => {
    sourceAndTarget([0])
    const result = await mergeComponentGroup($cwa as any, '/_/component_groups/top', '/_/component_groups/top')
    expect(updateResource).not.toHaveBeenCalled()
    expect(deleteResource).not.toHaveBeenCalled()
    expect(result).toEqual({ failed: [], sourceDeleted: false })
  })
})
