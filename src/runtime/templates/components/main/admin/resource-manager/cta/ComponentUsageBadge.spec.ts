// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { computed, defineComponent, reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import ComponentUsageBadge from './ComponentUsageBadge.vue'
import { navigateTo } from '#app/composables/router'
import * as cwaComposable from '#cwa/composables/cwa'
import { fetchComponentUsage } from '#cwa/admin/component-usage'
import { NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'
import NavigationGuard from '#cwa/admin/navigation-guard'
import type { AdminStore } from '#cwa/storage/stores/admin/admin-store'

vi.mock('#cwa/admin/component-usage', () => ({
  fetchComponentUsage: vi.fn(),
}))

vi.mock('#app/composables/router', () => ({
  navigateTo: vi.fn(),
}))

const COMPONENT = '/component/html_contents/c1'
const OTHER = '/component/html_contents/c2'

function mockCwa(initial: { iri?: string, byId?: Record<string, any>, displayPageIri?: string } = {}) {
  const state = reactive<{ iri: string | undefined, byId: Record<string, any>, displayPageIri: string | undefined }>({ iri: initial.iri ?? COMPONENT, byId: initial.byId ?? { [COMPONENT]: { '@id': COMPONENT, 'componentPositions': ['/_/component_positions/p1', '/_/component_positions/p2'] } }, displayPageIri: initial.displayPageIri })
  const cwa = {
    admin: { resourceStackManager: { currentIri: computed(() => state.iri) } },
    resources: {
      getResource: (iri: string) => computed(() => state.byId[iri] ? { data: state.byId[iri] } : undefined),
      displayPageIri: computed(() => state.displayPageIri),
    },
  }
  vi.spyOn(cwaComposable, 'useCwa').mockReturnValue(cwa as any)
  return { cwa, state }
}

async function mountBadge() {
  const wrapper = mount(ComponentUsageBadge)
  await flushPromises()
  return wrapper
}

function location(overrides: Record<string, any> = {}) {
  return { componentPosition: '/_/component_positions/p1', pageDataProperty: null, pageData: null, property: null, layout: null, renderedOn: [], renderedOnCount: 0, ...overrides }
}

function page(iri: string, title: string | null, routePath: string | null) {
  return { iri, title, routePath }
}

async function openList(usage: Record<string, any>, cwaOptions: Parameters<typeof mockCwa>[0] = {}) {
  vi.mocked(fetchComponentUsage).mockResolvedValue({ positionCount: 2, pageDataCount: 0, ...usage } as any)
  mockCwa(cwaOptions)
  const wrapper = mount(ComponentUsageBadge, { attachTo: document.body })
  await flushPromises()
  await wrapper.get('[data-testid="component-usage-badge"]').trigger('click')
  await flushPromises()
  const list = document.body.querySelector<HTMLElement>('[data-testid="component-usage-list"]')
  return { wrapper, list }
}

function rows(list: HTMLElement | null) {
  return [...(list?.querySelectorAll<HTMLElement>('[data-testid="component-usage-location"]') ?? [])].map(textsOf)
}

function textsOf(element: HTMLElement) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  const texts: string[] = []
  while (walker.nextNode()) {
    const text = walker.currentNode.textContent?.trim()
    if (text) {
      texts.push(text)
    }
  }
  return texts.join(' ')
}

function links(list: HTMLElement | null) {
  return [...(list?.querySelectorAll<HTMLAnchorElement>('a') ?? [])].map(a => [a.textContent?.trim(), a.getAttribute('href')])
}

async function routerEditingOn(path: string) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:path(.*)*', component: defineComponent({ render: () => null }) }] })
  const state = { isEditing: false, navigationGuardDisabled: false }
  const guard = new NavigationGuard(router, { useStore: () => ({ state }) } as unknown as AdminStore)
  router.beforeEach(guard.adminNavigationGuardFn)
  await router.push(path)
  await router.isReady()
  state.isEditing = true
  return router
}

describe('ComponentUsageBadge', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.mocked(navigateTo).mockReset()
    document.body.innerHTML = ''
  })

  test('says the selected component is shared and in how many places when it is used more than once', async () => {
    vi.mocked(fetchComponentUsage).mockResolvedValue({ positionCount: 2, pageDataCount: 1, total: 3 })
    const { cwa } = mockCwa()
    const wrapper = await mountBadge()
    expect(fetchComponentUsage).toHaveBeenCalledWith(cwa, COMPONENT)
    expect(wrapper.get('[data-testid="component-usage-badge"]').text()).toBe('Shared · 3 places')
  })

  test.each([
    ['used once', { positionCount: 1, pageDataCount: 0, total: 1 }],
    ['not answered', undefined],
  ])('shows nothing for a component %s', async (_label, usage) => {
    vi.mocked(fetchComponentUsage).mockResolvedValue(usage)
    mockCwa()
    const wrapper = await mountBadge()
    expect(wrapper.find('[data-testid="component-usage-badge"]').exists()).toBe(false)
  })

  test.each([
    ['a position', '/_/component_positions/p1', {}],
    ['a group', '/_/component_groups/g1', {}],
    ['a component being added', NEW_RESOURCE_IRI, {}],
    ['a component not yet saved', COMPONENT, { [COMPONENT]: { '@id': COMPONENT, '_metadata': { persisted: false } } }],
  ])('never asks for usage for %s', async (_label, iri, byId) => {
    mockCwa({ iri, byId })
    const wrapper = await mountBadge()
    expect(fetchComponentUsage).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="component-usage-badge"]').exists()).toBe(false)
  })

  test('reads usage again when another component is selected, dropping the previous answer at once', async () => {
    vi.mocked(fetchComponentUsage).mockResolvedValueOnce({ positionCount: 3, pageDataCount: 0, total: 3 })
    const { state } = mockCwa({ byId: { [COMPONENT]: { '@id': COMPONENT }, [OTHER]: { '@id': OTHER } } })
    const wrapper = await mountBadge()
    let resolveOther: (value: any) => void = () => {}
    vi.mocked(fetchComponentUsage).mockReturnValueOnce(new Promise((resolve) => {
      resolveOther = resolve
    }))
    state.iri = OTHER
    await flushPromises()
    expect(wrapper.find('[data-testid="component-usage-badge"]').exists()).toBe(false)
    resolveOther({ positionCount: 2, pageDataCount: 0, total: 2 })
    await flushPromises()
    expect(wrapper.get('[data-testid="component-usage-badge"]').text()).toBe('Shared · 2 places')
    expect(vi.mocked(fetchComponentUsage).mock.calls.map(call => call[1])).toEqual([COMPONENT, OTHER])
  })

  test('an answer for a component no longer selected is ignored', async () => {
    let resolveFirst: (value: any) => void = () => {}
    vi.mocked(fetchComponentUsage).mockReturnValueOnce(new Promise((resolve) => {
      resolveFirst = resolve
    }))
    vi.mocked(fetchComponentUsage).mockResolvedValueOnce({ positionCount: 1, pageDataCount: 0, total: 1 })
    const { state } = mockCwa({ byId: { [COMPONENT]: { '@id': COMPONENT }, [OTHER]: { '@id': OTHER } } })
    const wrapper = await mountBadge()
    state.iri = OTHER
    await flushPromises()
    resolveFirst({ positionCount: 5, pageDataCount: 0, total: 5 })
    await flushPromises()
    expect(wrapper.find('[data-testid="component-usage-badge"]').exists()).toBe(false)
  })

  test('a slow answer from before the component changed never overwrites the newer one', async () => {
    let resolveFirst: (value: any) => void = () => {}
    vi.mocked(fetchComponentUsage).mockReturnValueOnce(new Promise((resolve) => {
      resolveFirst = resolve
    }))
    vi.mocked(fetchComponentUsage).mockResolvedValueOnce({ positionCount: 1, pageDataCount: 0, total: 1 })
    const { state } = mockCwa()
    const wrapper = await mountBadge()
    state.byId[COMPONENT] = { ...state.byId[COMPONENT], componentPositions: ['/_/component_positions/p1'] }
    await flushPromises()
    resolveFirst({ positionCount: 2, pageDataCount: 0, total: 2 })
    await flushPromises()
    expect(wrapper.find('[data-testid="component-usage-badge"]').exists()).toBe(false)
  })

  test('reads usage again when the component gains or loses a position, as after a clone or a removal', async () => {
    vi.mocked(fetchComponentUsage).mockResolvedValueOnce({ positionCount: 2, pageDataCount: 0, total: 2 })
    const { state } = mockCwa()
    const wrapper = await mountBadge()
    vi.mocked(fetchComponentUsage).mockResolvedValueOnce({ positionCount: 1, pageDataCount: 0, total: 1 })
    state.byId[COMPONENT] = { ...state.byId[COMPONENT], componentPositions: ['/_/component_positions/p1'] }
    await flushPromises()
    expect(fetchComponentUsage).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="component-usage-badge"]').exists()).toBe(false)
  })

  describe('the list of places', () => {
    test('stays a plain count, not a button, when the API sends no locations, as for a non-admin or an older bundle', async () => {
      vi.mocked(fetchComponentUsage).mockResolvedValue({ positionCount: 2, pageDataCount: 0, total: 2 })
      mockCwa()
      const wrapper = await mountBadge()
      const badge = wrapper.get('[data-testid="component-usage-badge"]')
      expect(badge.element.tagName).toBe('SPAN')
      expect(badge.text()).toBe('Shared · 2 places')
      expect(wrapper.find('button').exists()).toBe(false)
    })

    test('the badge is a button that opens the list when the API sends locations', async () => {
      const { wrapper, list } = await openList({ total: 2, locations: [location({ renderedOn: [page('/_/pages/a', 'Home', '/')], renderedOnCount: 1 }), location({ renderedOn: [page('/_/pages/b', 'About', '/about')], renderedOnCount: 1 })] })
      const badge = wrapper.get('[data-testid="component-usage-badge"]')
      expect(badge.element.tagName).toBe('BUTTON')
      expect(badge.text()).toBe('Shared · 2 places')
      expect(list).not.toBeNull()
    })

    test('lists the places in the order the API returns them, without re-sorting', async () => {
      const { list } = await openList({ total: 3, locations: [
        location({ renderedOn: [page('/_/pages/z', 'Zebra', '/z')], renderedOnCount: 1 }),
        location({ renderedOn: [page('/_/pages/a', 'Apple', '/a')], renderedOnCount: 1 }),
        location({ renderedOn: [page('/_/pages/m', 'Mango', null)], renderedOnCount: 1 }),
      ] })
      expect(rows(list)).toEqual(['Zebra', 'Apple', 'Mango'])
    })

    test('a layout use names the layout and says it is on every page using it, with no link', async () => {
      const { list } = await openList({ total: 2, locations: [
        location({ layout: { iri: '/_/layouts/l1', reference: 'primary' } }),
        location({ renderedOn: [page('/_/pages/a', 'Apple', '/a')], renderedOnCount: 1 }),
      ] })
      expect(rows(list)[0]).toBe('Layout: primary on every page using it')
      expect(links(list)).toEqual([['Apple', '/a']])
    })

    test('each page a use renders on is linked to its route, and a page without a route is listed unlinked', async () => {
      const { list } = await openList({ total: 2, locations: [
        location({ renderedOn: [page('/_/pages/a', 'Apple', '/a'), page('/page_data/b', 'Banana', '/fruit/b'), page('/_/pages/t', 'Fruit template', null)], renderedOnCount: 3 }),
        location({ renderedOn: [page('/_/pages/u', 'Unrouted', null)], renderedOnCount: 1 }),
      ] })
      expect(links(list)).toEqual([['Apple', '/a'], ['Banana', '/fruit/b']])
      expect(rows(list)).toEqual(['Apple Banana Fruit template', 'Unrouted'])
    })

    test('a page with no title is named by its route', async () => {
      const { list } = await openList({ total: 2, locations: [
        location({ renderedOn: [page('/_/pages/a', null, '/a')], renderedOnCount: 1 }),
        location({ renderedOn: [page('/_/pages/b', null, null)], renderedOnCount: 1 }),
      ] })
      expect(rows(list)).toEqual(['/a', 'Untitled page'])
    })

    test('marks the page on screen as this page, unlinked', async () => {
      const { list } = await openList({ total: 2, locations: [
        location({ renderedOn: [page('/_/pages/a', 'Apple', '/a')], renderedOnCount: 1 }),
        location({ renderedOn: [page('/_/pages/b', 'Banana', '/b')], renderedOnCount: 1 }),
      ] }, { displayPageIri: '/_/pages/b' })
      expect(rows(list)).toEqual(['Apple', 'Banana This page'])
      expect(links(list)).toEqual([['Apple', '/a']])
    })

    test('says how many more pages a use renders on beyond those listed', async () => {
      const { list } = await openList({ total: 2, locations: [
        location({ renderedOn: [page('/_/pages/a', 'Apple', '/a'), page('/_/pages/b', 'Banana', '/b')], renderedOnCount: 25 }),
        location({ renderedOn: [page('/_/pages/c', 'Cherry', '/c')], renderedOnCount: 1 }),
      ] })
      expect(rows(list)).toEqual(['Apple Banana and 23 more', 'Cherry'])
    })

    test('ends with how many more places there are beyond those listed', async () => {
      const { list } = await openList({ total: 52, locations: [
        location({ renderedOn: [page('/_/pages/a', 'Apple', '/a')], renderedOnCount: 1 }),
        location({ renderedOn: [page('/_/pages/b', 'Banana', '/b')], renderedOnCount: 1 }),
      ] })
      expect(list?.querySelector('[data-testid="component-usage-more"]')?.textContent?.trim()).toBe('and 50 more places')
    })

    test('says nothing more when every place is listed', async () => {
      const { list } = await openList({ total: 2, locations: [
        location({ renderedOn: [page('/_/pages/a', 'Apple', '/a')], renderedOnCount: 1 }),
        location({ renderedOn: [page('/_/pages/b', 'Banana', '/b')], renderedOnCount: 1 }),
      ] })
      expect(list?.querySelector('[data-testid="component-usage-more"]')).toBeNull()
      expect(list?.textContent).not.toContain('more')
    })

    test('a dynamic position\'s fallback is labelled as the template\'s default for that slot', async () => {
      const { list } = await openList({ total: 2, locations: [
        location({ pageDataProperty: 'heroComponent', renderedOn: [page('/page_data/a', 'Article A', '/blog/a'), page('/_/pages/t', 'Blog template', null)], renderedOnCount: 2 }),
        location({ renderedOn: [page('/_/pages/b', 'Banana', '/b')], renderedOnCount: 1 }),
      ] })
      expect(rows(list)[0]).toBe('Template default for heroComponent Article A Blog template')
    })

    test('following a link while editing navigates past the editing guard, as Enable Navigation does, and closes the list', async () => {
      const router = await routerEditingOn('/start')
      vi.mocked(navigateTo).mockImplementation(to => router.push(to as any) as any)
      const { list } = await openList({ total: 2, locations: [
        location({ renderedOn: [page('/_/pages/a', 'Apple', '/a')], renderedOnCount: 1 }),
        location({ renderedOn: [page('/_/pages/b', 'Banana', '/b')], renderedOnCount: 1 }),
      ] })
      list?.querySelector<HTMLAnchorElement>('a[href="/b"]')?.click()
      await flushPromises()
      expect(navigateTo).toHaveBeenCalledTimes(1)
      expect(router.currentRoute.value.fullPath).toBe('/b')
      expect(document.body.querySelector('[data-testid="component-usage-list"]')).toBeNull()
    })

    test('the editing guard in that test is live: a plain push while editing is blocked', async () => {
      const router = await routerEditingOn('/start')
      await router.push('/b')
      expect(router.currentRoute.value.fullPath).toBe('/start')
    })
  })
})
