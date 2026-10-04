// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, defineComponent, nextTick, reactive } from 'vue'
import { mount } from '@vue/test-utils'
import { mergeComponentGroup, useStrandedComponentGroups } from './stranded-component-groups'
import type { ComponentGroupDeclarations } from './stranded-component-groups'
import * as cwaComposable from '#cwa/composables/cwa'

const declarations = vi.hoisted(() => ({}) as ComponentGroupDeclarations)

vi.mock('#build/cwa-component-group-declarations', () => ({ componentGroupDeclarations: declarations }))

type StoredResource = { data: Record<string, any> }

const store = reactive<Record<string, StoredResource>>({})
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

function draftOf(iri: string) {
  return Object.keys(store).find(key => store[key]!.data.publishedResource === iri)
}

const $cwa = {
  auth: { isAdmin: computed(() => state.isAdmin) },
  resources: {
    isLoading: computed(() => state.isLoading),
    get layoutIri() {
      return computed(() => state.layout)
    },
    get depthCount() {
      return computed(() => state.pages.length)
    },
    pageIriAtDepth: (depth: number) => computed(() => state.pages[depth]),
    getResource: (iri: string) => computed(() => store[iri]),
    getOrderedPositionsForGroup: vi.fn((iri: string, _includeNew?: boolean) => orderedPositions(iri)),
    findAllPublishableIris: (iri: string) => {
      const related = store[iri]?.data.publishedResource ?? draftOf(iri)
      return related ? [iri, related] : [iri]
    },
    findPublishedComponentIri: (iri: string) => computed(() => {
      const data = store[iri]?.data
      if (!data) {
        return undefined
      }
      return data.publishedResource ?? (data.draft ? undefined : iri)
    }),
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

function declare(value: ComponentGroupDeclarations) {
  Object.assign(declarations, value)
}

function mountDetector() {
  let result!: ReturnType<typeof useStrandedComponentGroups>
  const wrapper = mount(defineComponent({
    setup() {
      result = useStrandedComponentGroups()
      return () => null
    },
  }))
  return { wrapper, result }
}

function homePage(groups: string[], uiComponent = 'PrimaryPageTemplate') {
  put('/_/pages/home', { '@type': 'Page', uiComponent, 'componentGroups': groups })
}

function mainLayout(groups: string[], uiComponent: string | null = 'CwaLayoutPrimary') {
  put('/_/layouts/main', { '@type': 'Layout', uiComponent, 'componentGroups': groups })
}

describe('useStrandedComponentGroups', () => {
  let wrapper: ReturnType<typeof mount> | undefined

  function detect() {
    const detector = mountDetector()
    wrapper = detector.wrapper
    return detector.result
  }

  const strandedIris = (result: ReturnType<typeof useStrandedComponentGroups>) => result.stranded.value.map(g => g.iri)

  beforeEach(() => {
    // @ts-expect-error partial Cwa
    vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => $cwa)
    declare({
      CwaLayoutPrimary: [{ reference: 'top', location: 'layout' }],
      CwaPagePrimaryPageTemplate: [{ reference: 'primary', location: 'self' }],
    })
    mainLayout([])
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    for (const key of Object.keys(store)) {
      delete store[key]
    }
    for (const key of Object.keys(declarations)) {
      delete declarations[key]
    }
    state.isLoading = false
    state.isAdmin = true
    state.pages = ['/_/pages/home']
    state.layout = '/_/layouts/main'
    vi.restoreAllMocks()
  })

  test('flags the group left behind by a renamed reference, and offers the declared one as a target', () => {
    homePage(['/_/component_groups/primary', '/_/component_groups/old'])
    group('/_/component_groups/primary', 'primary', '/_/pages/home')
    group('/_/component_groups/old', 'main', '/_/pages/home')
    const result = detect()
    expect(result.stranded.value).toEqual([{ iri: '/_/component_groups/old', reference: 'main', positions: [] }])
    expect(result.shown.value).toEqual([{ iri: '/_/component_groups/primary', reference: 'primary' }])
  })

  test('reads the page template with or without its CwaPage prefix', () => {
    homePage(['/_/component_groups/primary', '/_/component_groups/old'], 'CwaPagePrimaryPageTemplate')
    group('/_/component_groups/primary', 'primary', '/_/pages/home')
    group('/_/component_groups/old', 'main', '/_/pages/home')
    expect(strandedIris(detect())).toEqual(['/_/component_groups/old'])
  })

  test('a self-located declaration only matches its own resource, so a group suffixed with another IRI is flagged', () => {
    homePage(['/_/component_groups/elsewhere'])
    group('/_/component_groups/elsewhere', 'primary', '/_/pages/other')
    expect(strandedIris(detect())).toEqual(['/_/component_groups/elsewhere'])
  })

  test('flags a legacy group located at a component\'s draft IRI once the component is published', () => {
    declare({ CwaComponentTabs: [{ reference: 'tabs', location: 'self' }] })
    homePage(['/_/component_groups/primary'])
    group('/_/component_groups/primary', 'primary', '/_/pages/home', ['/_/component_positions/p1'])
    position('/_/component_positions/p1', '/_/component_groups/primary', 0, '/component/tabs/draft')
    put('/component/tabs/draft', { '@type': 'Tabs', 'draft': true, 'publishedResource': '/component/tabs/live', 'componentGroups': ['/_/component_groups/legacy'] })
    put('/component/tabs/live', { '@type': 'Tabs', 'componentGroups': ['/_/component_groups/tabs'] })
    group('/_/component_groups/legacy', 'tabs', '/component/tabs/draft')
    group('/_/component_groups/tabs', 'tabs', '/component/tabs/live')
    const result = detect()
    expect(strandedIris(result)).toEqual(['/_/component_groups/legacy'])
    expect(result.stranded.value[0]!.reference).toBe('tabs')
    expect(result.shown.value.map(g => g.iri)).toEqual(['/_/component_groups/primary', '/_/component_groups/tabs'])
  })

  test('a never-published draft component locates its groups at its draft IRI', () => {
    declare({ CwaComponentTabs: [{ reference: 'tabs', location: 'self' }] })
    homePage(['/_/component_groups/primary'])
    group('/_/component_groups/primary', 'primary', '/_/pages/home', ['/_/component_positions/p1'])
    position('/_/component_positions/p1', '/_/component_groups/primary', 0, '/component/tabs/draft')
    put('/component/tabs/draft', { '@type': 'Tabs', 'draft': true, 'componentGroups': ['/_/component_groups/tabs'] })
    group('/_/component_groups/tabs', 'tabs', '/component/tabs/draft')
    expect(strandedIris(detect())).toEqual([])
  })

  test('uses the declarations of the component\'s selected ui variant', () => {
    declare({
      CwaComponentHero: [{ reference: 'body', location: 'self' }],
      CwaComponentHeroUiWide: [{ reference: 'columns', location: 'self' }],
    })
    homePage(['/_/component_groups/primary'])
    group('/_/component_groups/primary', 'primary', '/_/pages/home', ['/_/component_positions/p1'])
    position('/_/component_positions/p1', '/_/component_groups/primary', 0, '/component/hero/1')
    put('/component/hero/1', { '@type': 'Hero', 'uiComponent': 'CwaComponentHeroUiWide', 'componentGroups': ['/_/component_groups/body', '/_/component_groups/columns'] })
    group('/_/component_groups/body', 'body', '/component/hero/1')
    group('/_/component_groups/columns', 'columns', '/component/hero/1')
    expect(strandedIris(detect())).toEqual(['/_/component_groups/body'])
  })

  test('a layout group declared in any template is not flagged, even one rendered only on other pages', () => {
    declare({ CwaComponentHeroSection: [{ reference: 'links', location: 'layout' }] })
    mainLayout(['/_/component_groups/top', '/_/component_groups/links', '/_/component_groups/gone'])
    group('/_/component_groups/top', 'top', '/_/layouts/main')
    group('/_/component_groups/links', 'links', '/_/layouts/main')
    group('/_/component_groups/gone', 'gone', '/_/layouts/main')
    homePage([])
    expect(strandedIris(detect())).toEqual(['/_/component_groups/gone'])
  })

  test('a layout-located declaration matches only the current layout', () => {
    mainLayout(['/_/component_groups/old-layout-top'])
    group('/_/component_groups/old-layout-top', 'top', '/_/layouts/old')
    homePage([])
    expect(strandedIris(detect())).toEqual(['/_/component_groups/old-layout-top'])
  })

  test('a fixed location reference matches exactly, wherever the group is attached', () => {
    declare({ CwaLayoutPrimary: [{ reference: 'header-menu', location: 'fixed', locationReference: 'header-menu' }] })
    mainLayout(['/_/component_groups/header', '/_/component_groups/header-renamed'])
    put('/_/component_groups/header', { '@type': 'ComponentGroup', 'reference': 'header-menu_header-menu', 'location': '/_/layouts/main' })
    put('/_/component_groups/header-renamed', { '@type': 'ComponentGroup', 'reference': 'header-menu_header', 'location': '/_/layouts/main' })
    homePage([])
    expect(strandedIris(detect())).toEqual(['/_/component_groups/header-renamed'])
  })

  test('a group whose reference starts with an unknown-located declaration is never flagged', () => {
    declare({ CwaComponentHeroSection: [{ reference: 'hero-tabgroup', location: 'unknown' }] })
    homePage(['/_/component_groups/tabgroup', '/_/component_groups/other'])
    group('/_/component_groups/tabgroup', 'hero-tabgroup', '/_/pages/home')
    group('/_/component_groups/other', 'hero-tabs', '/_/pages/home')
    expect(strandedIris(detect())).toEqual(['/_/component_groups/other'])
  })

  test('a dynamic reference located at the owner matches any group on that owner', () => {
    declare({ CwaPagePrimaryPageTemplate: [{ reference: null, location: 'self' }] })
    homePage(['/_/component_groups/anything', '/_/component_groups/elsewhere'])
    group('/_/component_groups/anything', 'whatever', '/_/pages/home')
    group('/_/component_groups/elsewhere', 'whatever', '/_/pages/other')
    expect(strandedIris(detect())).toEqual(['/_/component_groups/elsewhere'])
  })

  test('a dynamic reference at an unknown location anywhere means nothing can be flagged', () => {
    declare({ CwaComponentOpaque: [{ reference: null, location: 'unknown' }] })
    homePage(['/_/component_groups/old'])
    group('/_/component_groups/old', 'main', '/_/pages/home')
    expect(strandedIris(detect())).toEqual([])
  })

  test('never flags the groups of an owner whose template the build did not see', () => {
    homePage(['/_/component_groups/old'], 'UnknownTemplate')
    group('/_/component_groups/old', 'main', '/_/pages/home')
    mainLayout(['/_/component_groups/layout-old'], null)
    group('/_/component_groups/layout-old', 'gone', '/_/layouts/main')
    const result = detect()
    expect(strandedIris(result)).toEqual([])
    expect(result.shown.value).toEqual([])
  })

  test('checks the page at every nested depth against its own template', () => {
    declare({ CwaPageChildTemplate: [{ reference: 'child', location: 'self' }] })
    state.pages = ['/_/pages/parent', '/_/pages/child']
    put('/_/pages/parent', { '@type': 'Page', 'uiComponent': 'PrimaryPageTemplate', 'componentGroups': ['/_/component_groups/parent-main'] })
    put('/_/pages/child', { '@type': 'Page', 'uiComponent': 'ChildTemplate', 'componentGroups': ['/_/component_groups/child', '/_/component_groups/child-old'] })
    group('/_/component_groups/parent-main', 'primary', '/_/pages/parent')
    group('/_/component_groups/child', 'child', '/_/pages/child')
    group('/_/component_groups/child-old', 'primary', '/_/pages/child')
    expect(strandedIris(detect())).toEqual(['/_/component_groups/child-old'])
  })

  test('a group attached to two owners is not flagged if either declares it', () => {
    homePage(['/_/component_groups/shared'])
    mainLayout(['/_/component_groups/shared'])
    group('/_/component_groups/shared', 'primary', '/_/pages/home')
    expect(strandedIris(detect())).toEqual([])
  })

  test('does not separately list groups owned by components inside a stranded group', () => {
    declare({ CwaComponentTabs: [] })
    homePage(['/_/component_groups/old'])
    group('/_/component_groups/old', 'main', '/_/pages/home', ['/_/component_positions/p1'])
    position('/_/component_positions/p1', '/_/component_groups/old', 0, '/component/tabs/1')
    put('/component/tabs/1', { '@type': 'Tabs', 'componentGroups': ['/_/component_groups/inner'] })
    group('/_/component_groups/inner', 'inner', '/component/tabs/1')
    expect(strandedIris(detect())).toEqual(['/_/component_groups/old'])
  })

  test('lists each stranded group\'s positions in order with their component type, including dynamic positions', () => {
    homePage(['/_/component_groups/old'])
    group('/_/component_groups/old', 'main', '/_/pages/home', ['/_/component_positions/b', '/_/component_positions/a', '/_/component_positions/dyn'])
    position('/_/component_positions/a', '/_/component_groups/old', 0, '/component/html/1')
    position('/_/component_positions/b', '/_/component_groups/old', 1, '/component/image/1')
    position('/_/component_positions/dyn', '/_/component_groups/old', 2, undefined, { pageDataProperty: 'heroImage' })
    put('/component/html/1', { '@type': 'HtmlContent' })
    put('/component/image/1', { '@type': 'Image' })
    expect(detect().stranded.value[0]!.positions).toEqual([
      { iri: '/_/component_positions/a', component: '/component/html/1', componentType: 'HtmlContent', pageDataProperty: undefined },
      { iri: '/_/component_positions/b', component: '/component/image/1', componentType: 'Image', pageDataProperty: undefined },
      { iri: '/_/component_positions/dyn', component: undefined, componentType: undefined, pageDataProperty: 'heroImage' },
    ])
  })

  test('skips attached groups that are not in the store', () => {
    homePage(['/_/component_groups/deleted'])
    expect(strandedIris(detect())).toEqual([])
  })

  test('reports nothing to a non-admin', () => {
    state.isAdmin = false
    homePage(['/_/component_groups/old'])
    group('/_/component_groups/old', 'main', '/_/pages/home')
    const result = detect()
    expect(result.stranded.value).toEqual([])
    expect(result.shown.value).toEqual([])
  })

  test('reports nothing while the page is loading, and reacts once it has loaded', async () => {
    state.isLoading = true
    homePage(['/_/component_groups/old'])
    group('/_/component_groups/old', 'main', '/_/pages/home')
    const result = detect()
    expect(result.stranded.value).toEqual([])
    state.isLoading = false
    await nextTick()
    expect(strandedIris(result)).toEqual(['/_/component_groups/old'])
    group('/_/component_groups/old', 'primary', '/_/pages/home')
    await nextTick()
    expect(strandedIris(result)).toEqual([])
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
