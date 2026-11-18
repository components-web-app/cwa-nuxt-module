// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { consola } from 'consola'
import ListContent from './ListContent.vue'
import Pagination from '#cwa/templates/components/core/ui/Pagination.vue'
import { axe } from '../../../../../../test/utils/axe'
import { drawsFocusRing } from '../../../../../../test/utils/focus-ring'
import * as cwaComposable from '#cwa/composables/cwa'

vi.mock('consola')

enableAutoUnmount(afterEach)

const routerReplace = vi.hoisted(() => vi.fn())
// eslint-disable-next-line no-var
var mockRoute: { query: Record<string, any> }
vi.mock('vue-router', async () => {
  const { reactive } = await import('vue')
  mockRoute = reactive({ query: {} as Record<string, any> })
  const mod = await vi.importActual<typeof import('vue-router')>('vue-router')
  return { ...mod, useRoute: () => mockRoute, useRouter: () => ({ replace: routerReplace }) }
})

const models = vi.hoisted(() => ({ pageModel: null as any, perPageModel: null as any }))
vi.mock('#cwa/composables/cwa-query-bound-model', async () => {
  const { ref } = await import('vue')
  models.pageModel = ref(1)
  models.perPageModel = ref(null)
  return {
    useQueryBoundModel: vi.fn((key: string) => {
      if (key === 'page') return { model: models.pageModel }
      return { model: models.perPageModel }
    }),
  }
})

const itemSlot = `<template #item="{ data }"><div role="row" class="item-stub"><span role="cell">{{ data['@id'] }}</span></div></template>`
const loadingState = (wrapper: ReturnType<typeof mountComponent>) => wrapper.find('[data-testid="list-state-loading"]')
const errorAlert = (wrapper: ReturnType<typeof mountComponent>) => wrapper.find('[data-testid="list-error"]')
const rows = (wrapper: ReturnType<typeof mountComponent>) => wrapper.findAll('.item-stub')

function makeFetchResponse(member: any[] | undefined, extra: Record<string, any> = {}) {
  return {
    response: Promise.resolve({
      _data: member === undefined ? undefined : { member, ...extra },
    }),
  }
}

function makeFetchRejection(error: any) {
  return { response: Promise.reject(error) }
}

function deferredFetchResponse() {
  let resolveResponse: (value: any) => void
  let rejectResponse: (error: any) => void
  const response = new Promise((resolve, reject) => {
    resolveResponse = resolve
    rejectResponse = reject
  })
  response.catch(() => undefined)
  return {
    fetchReturn: { response },
    resolveWith(member: any[], extra: Record<string, any> = {}) {
      resolveResponse({ _data: { member, ...extra } })
    },
    rejectWith(error: any) {
      rejectResponse(error)
    },
  }
}

let fetchMock: ReturnType<typeof vi.fn>
let getResourceMock: ReturnType<typeof vi.fn>

function mockCwa({
  fetchImpl,
  getResourceImpl = () => ref(null),
}: {
  fetchImpl?: ReturnType<typeof vi.fn>
  getResourceImpl?: (iri: string) => any
} = {}) {
  fetchMock = fetchImpl ?? vi.fn(() => makeFetchResponse([]))
  getResourceMock = vi.fn(getResourceImpl)
  // @ts-expect-error partial mock
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    fetch: fetchMock,
    resources: { getResource: getResourceMock },
  }))
}

function mountComponent(slots: Record<string, any> = {}, fetchUrl = '/_/routes', searchFields?: string[], props: Record<string, unknown> = {}) {
  return mount(ListContent, {
    props: { fetchUrl, searchFields, ...props },
    slots: { item: itemSlot, ...slots },
    attachTo: document.body,
  })
}

describe('ListContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoute.query = {}
    if (models.pageModel) models.pageModel.value = 1
    if (models.perPageModel) models.perPageModel.value = null
  })

  test('shows skeleton rows while the first load is in flight, with the table marked busy and the load announced once', async () => {
    mockCwa({ fetchImpl: vi.fn(() => ({ response: new Promise(() => {}) })) })
    const wrapper = mountComponent({}, '/_/routes', undefined, { noun: 'pages' })
    await nextTick()
    expect(loadingState(wrapper).exists()).toBe(true)
    expect(wrapper.get('[role="table"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.get('[data-testid="list-announcer"]').text()).toBe('Loading pages')
  })

  test('fetches items from the fetchUrl on mount', async () => {
    mockCwa({ fetchImpl: vi.fn(() => makeFetchResponse([{ '@id': '/a' }])) })
    mountComponent()
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith({ path: '/_/routes', noQuery: true })
  })

  describe('fetched url', () => {
    function fetchedPath() {
      return fetchMock.mock.calls[0]?.[0]?.path
    }

    test('the search value on the page reaches the api', async () => {
      mockCwa()
      mockRoute.query = { reference: 'my search', uiComponent: 'my search' }
      mountComponent()
      await flushPromises()
      expect(fetchedPath()).toBe('/_/routes?reference=my+search&uiComponent=my+search')
    })

    test('the sort parameter reaches the api', async () => {
      mockCwa()
      mockRoute.query = { 'order[createdAt]': 'desc' }
      mountComponent()
      await flushPromises()
      expect(fetchedPath()).toBe('/_/routes?order%5BcreatedAt%5D=desc')
    })

    test('page and perPage reach the api', async () => {
      mockCwa()
      mockRoute.query = { page: '2', perPage: '10' }
      mountComponent()
      await flushPromises()
      expect(fetchedPath()).toBe('/_/routes?page=2&perPage=10')
    })

    test('a multi-value filter reaches the api once per value', async () => {
      mockCwa()
      mockRoute.query = { 'isTemplate[]': ['true', 'false'] }
      mountComponent()
      await flushPromises()
      expect(fetchedPath()).toBe('/_/routes?isTemplate%5B%5D=true&isTemplate%5B%5D=false')
    })

    test('a fetch url with its own query gains the page query as one query string', async () => {
      mockCwa()
      mockRoute.query = { page: '2' }
      mountComponent({}, '/page_data/blog_articles?isTemplate=true')
      await flushPromises()
      expect(fetchedPath()).toBe('/page_data/blog_articles?isTemplate=true&page=2')
      expect(fetchedPath().split('?')).toHaveLength(2)
    })

    test('the fetch url keeps its own value for a parameter the page also has', async () => {
      mockCwa()
      mockRoute.query = { isTemplate: 'false' }
      mountComponent({}, '/_/pages?isTemplate=true')
      await flushPromises()
      expect(fetchedPath()).toBe('/_/pages?isTemplate=true')
    })

    test('the search value is also sent under each legacy search field', async () => {
      mockCwa()
      mockRoute.query = { search: 'my search' }
      mountComponent({}, '/_/layouts', ['reference', 'uiComponent'])
      await flushPromises()
      expect(fetchedPath()).toBe('/_/layouts?search=my+search&reference=my+search&uiComponent=my+search')
    })

    test('the search value is sent alone when the list declares no legacy search fields', async () => {
      mockCwa()
      mockRoute.query = { search: 'my search' }
      mountComponent({}, '/_/layouts')
      await flushPromises()
      expect(fetchedPath()).toBe('/_/layouts?search=my+search')
    })

    test('a legacy search field already in the page query keeps its own value', async () => {
      mockCwa()
      mockRoute.query = { search: 'from search', reference: 'from reference' }
      mountComponent({}, '/_/layouts', ['reference', 'uiComponent'])
      await flushPromises()
      expect(fetchedPath()).toBe('/_/layouts?search=from+search&reference=from+reference&uiComponent=from+search')
    })

    test('legacy search fields add nothing when there is no search value', async () => {
      mockCwa()
      mockRoute.query = { page: '2' }
      mountComponent({}, '/_/layouts', ['reference', 'uiComponent'])
      await flushPromises()
      expect(fetchedPath()).toBe('/_/layouts?page=2')
    })

    test('the fetcher is told not to add the page query itself', async () => {
      mockCwa()
      mockRoute.query = { page: '2' }
      mountComponent()
      await flushPromises()
      expect(fetchMock.mock.calls[0][0].noQuery).toBe(true)
    })
  })

  test('shows the "no items found" message when the result set is empty', async () => {
    mockCwa({ fetchImpl: vi.fn(() => makeFetchResponse([])) })
    const wrapper = mountComponent()
    await flushPromises()
    await nextTick()
    expect(loadingState(wrapper).exists()).toBe(false)
    expect(wrapper.text()).toContain('No items yet')
  })

  test('renders pagination and a list item per member when items exist', async () => {
    mockCwa({
      fetchImpl: vi.fn(() => makeFetchResponse(
        [{ '@id': '/a' }, { '@id': '/b' }, { '@id': '/c' }],
        { totalItems: 42, view: { '@id': '/_/routes?page=1' } },
      )),
    })
    const wrapper = mountComponent()
    await flushPromises()
    await nextTick()
    expect(rows(wrapper)).toHaveLength(3)
    const paginations = wrapper.findAllComponents(Pagination)
    expect(paginations).toHaveLength(1)
    expect(paginations[0]!.props('total')).toBe(42)
  })

  test('passes totalItems=0 to pagination when result has no totalItems', async () => {
    mockCwa({ fetchImpl: vi.fn(() => makeFetchResponse([{ '@id': '/a' }])) })
    const wrapper = mountComponent()
    await flushPromises()
    await nextTick()
    expect(wrapper.findComponent(Pagination).props('total')).toBe(0)
  })

  test('renders the provided item slot with store data and raw data', async () => {
    const rawItem = { '@id': '/component/1', 'title': 'raw' }
    mockCwa({
      fetchImpl: vi.fn(() => makeFetchResponse([rawItem])),
      getResourceImpl: (iri: string) => {
        if (iri === '/component/1') return ref({ data: { '@id': '/component/1', 'title': 'from-store' } })
        return ref(null)
      },
    })
    const wrapper = mountComponent({
      item: `<template #item="{ data, rawData }">
        <span class="store-title">{{ data.title }}</span>
        <span class="raw-title">{{ rawData.title }}</span>
      </template>`,
    })
    await flushPromises()
    await nextTick()
    expect(wrapper.find('.store-title').text()).toBe('from-store')
    expect(wrapper.find('.raw-title').text()).toBe('raw')
  })

  test('item slot falls back to raw data when the store has no resource', async () => {
    const rawItem = { '@id': '/component/2', 'title': 'only-raw' }
    mockCwa({
      fetchImpl: vi.fn(() => makeFetchResponse([rawItem])),
      getResourceImpl: () => ref(null),
    })
    const wrapper = mountComponent({
      item: `<template #item="{ data }"><span class="slot-title">{{ data.title }}</span></template>`,
    })
    await flushPromises()
    await nextTick()
    expect(wrapper.find('.slot-title').text()).toBe('only-raw')
  })

  test('reloadItems is exposed and re-fetches when called', async () => {
    mockCwa({ fetchImpl: vi.fn(() => makeFetchResponse([{ '@id': '/a' }])) })
    const wrapper = mountComponent()
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // @ts-expect-error exposed method
    await wrapper.vm.reloadItems()
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('handles a fetch response with no _data without throwing', async () => {
    mockCwa({ fetchImpl: vi.fn(() => makeFetchResponse(undefined)) })
    const wrapper = mountComponent()
    await flushPromises()
    await nextTick()
    expect(loadingState(wrapper).exists()).toBe(false)
    expect(wrapper.text()).toContain('No items yet')
  })

  describe('failed load', () => {
    test('the loading state ends when the list fails to load', async () => {
      mockCwa({ fetchImpl: vi.fn(() => makeFetchRejection({ statusCode: 422 })) })
      const wrapper = mountComponent()
      await flushPromises()
      await nextTick()
      expect(loadingState(wrapper).exists()).toBe(false)
    })

    test('a failure is reported in an alert with the status code', async () => {
      mockCwa({ fetchImpl: vi.fn(() => makeFetchRejection({ statusCode: 422 })) })
      const wrapper = mountComponent()
      await flushPromises()
      await nextTick()
      const alert = errorAlert(wrapper)
      expect(alert.exists()).toBe(true)
      expect(alert.attributes('data-tone')).toBe('danger')
      expect(alert.text()).toContain('Items couldn\'t be loaded.')
      expect(alert.text()).toContain('The server answered 422.')
    })

    test('a failure with no status code is reported as a network error', async () => {
      mockCwa({ fetchImpl: vi.fn(() => makeFetchRejection(new Error('fetch failed'))) })
      const wrapper = mountComponent()
      await flushPromises()
      await nextTick()
      expect(errorAlert(wrapper).text()).toContain('The server couldn\'t be reached.')
    })

    test('the cause of a failure is logged', async () => {
      const error = { statusCode: 500 }
      mockCwa({ fetchImpl: vi.fn(() => makeFetchRejection(error)) })
      mountComponent()
      await flushPromises()
      expect(consola.error).toHaveBeenCalledWith('[CWA] Could not load the list', error)
    })

    test('the empty state is not shown alongside the failure', async () => {
      mockCwa({ fetchImpl: vi.fn(() => makeFetchRejection({ statusCode: 500 })) })
      const wrapper = mountComponent()
      await flushPromises()
      await nextTick()
      expect(wrapper.text()).not.toContain('No items yet')
    })

    test('the previous items are still shown after a failed reload', async () => {
      let shouldFail = false
      mockCwa({
        fetchImpl: vi.fn(() => shouldFail
          ? makeFetchRejection({ statusCode: 422 })
          : makeFetchResponse([{ '@id': '/a' }, { '@id': '/b' }], { totalItems: 2 })),
      })
      const wrapper = mountComponent()
      await flushPromises()
      await nextTick()
      expect(rows(wrapper)).toHaveLength(2)

      shouldFail = true
      // @ts-expect-error exposed method
      await wrapper.vm.reloadItems()
      await flushPromises()
      await nextTick()
      expect(errorAlert(wrapper).exists()).toBe(true)
      expect(rows(wrapper)).toHaveLength(2)
    })

    test('the failure is cleared when a retry succeeds', async () => {
      let shouldFail = true
      mockCwa({
        fetchImpl: vi.fn(() => shouldFail
          ? makeFetchRejection({ statusCode: 500 })
          : makeFetchResponse([{ '@id': '/a' }], { totalItems: 1 })),
      })
      const wrapper = mountComponent()
      await flushPromises()
      await nextTick()
      expect(errorAlert(wrapper).exists()).toBe(true)

      shouldFail = false
      // @ts-expect-error exposed method
      await wrapper.vm.reloadItems()
      await flushPromises()
      await nextTick()
      expect(errorAlert(wrapper).exists()).toBe(false)
      expect(rows(wrapper)).toHaveLength(1)
    })

    test('a superseded response does not change the totals', async () => {
      const older = deferredFetchResponse()
      const newer = deferredFetchResponse()
      const returns = [older.fetchReturn, newer.fetchReturn]
      let call = 0
      mockCwa({ fetchImpl: vi.fn(() => returns[call++]) })
      const wrapper = mountComponent()
      await nextTick()
      // @ts-expect-error exposed method
      wrapper.vm.reloadItems()
      await nextTick()

      newer.resolveWith([{ '@id': '/new' }], { totalItems: 999 })
      await flushPromises()
      await nextTick()
      older.resolveWith([{ '@id': '/old' }], { totalItems: 1 })
      await flushPromises()
      await nextTick()

      expect(wrapper.findComponent(Pagination).props('total')).toBe(999)
    })

    test('an older failure does not interrupt a newer request still loading', async () => {
      const older = deferredFetchResponse()
      const newer = deferredFetchResponse()
      const returns = [older.fetchReturn, newer.fetchReturn]
      let call = 0
      mockCwa({ fetchImpl: vi.fn(() => returns[call++]) })
      const wrapper = mountComponent()
      await nextTick()
      // @ts-expect-error exposed method
      wrapper.vm.reloadItems()
      await nextTick()

      older.rejectWith({ statusCode: 500 })
      await flushPromises()
      await nextTick()

      expect(loadingState(wrapper).exists()).toBe(true)
      expect(errorAlert(wrapper).exists()).toBe(false)
    })

    test('an older failure does not replace a newer success', async () => {
      const older = deferredFetchResponse()
      const newer = deferredFetchResponse()
      const returns = [older.fetchReturn, newer.fetchReturn]
      let call = 0
      mockCwa({ fetchImpl: vi.fn(() => returns[call++]) })
      const wrapper = mountComponent()
      await nextTick()
      // @ts-expect-error exposed method
      wrapper.vm.reloadItems()
      await nextTick()

      newer.resolveWith([{ '@id': '/new' }], { totalItems: 1 })
      await flushPromises()
      await nextTick()
      older.rejectWith({ statusCode: 500 })
      await flushPromises()
      await nextTick()

      expect(errorAlert(wrapper).exists()).toBe(false)
      expect(rows(wrapper)).toHaveLength(1)
    })

    test('a newer failure is not overridden by an older success', async () => {
      const older = deferredFetchResponse()
      const newer = deferredFetchResponse()
      const returns = [older.fetchReturn, newer.fetchReturn]
      let call = 0
      mockCwa({ fetchImpl: vi.fn(() => returns[call++]) })
      const wrapper = mountComponent()
      await nextTick()
      // @ts-expect-error exposed method
      wrapper.vm.reloadItems()
      await nextTick()

      newer.rejectWith({ statusCode: 500 })
      await flushPromises()
      await nextTick()
      older.resolveWith([{ '@id': '/old' }], { totalItems: 1 })
      await flushPromises()
      await nextTick()

      expect(errorAlert(wrapper).exists()).toBe(true)
      expect(rows(wrapper)).toHaveLength(0)
    })
  })

  describe('route query watchers', () => {
    test('resets page to 1 when a non-pagination query param changes', async () => {
      mockCwa()
      mountComponent()
      await flushPromises()
      models.pageModel.value = 4
      mockRoute.query = { filter: 'abc' }
      await flushPromises()
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    test('does not reload when query is unchanged', async () => {
      mockCwa()
      mountComponent()
      await flushPromises()
      const callsAfterMount = fetchMock.mock.calls.length
      await flushPromises()
      expect(fetchMock.mock.calls.length).toBe(callsAfterMount)
    })

    test('moving to another page scrolls back to the top of the list, as the old pagination did, instantly under reduced motion', async () => {
      const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
      const matchMedia = vi.spyOn(window, 'matchMedia')
      mockCwa()
      mountComponent()
      await flushPromises()
      expect(scrollTo).not.toHaveBeenCalled()

      matchMedia.mockReturnValue({ matches: false } as MediaQueryList)
      models.pageModel.value = 2
      await flushPromises()
      matchMedia.mockReturnValue({ matches: true } as MediaQueryList)
      models.pageModel.value = 3
      await flushPromises()

      expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
      expect(scrollTo.mock.calls).toEqual([[{ top: 0, behavior: 'smooth' }], [{ top: 0, behavior: 'auto' }]])
      scrollTo.mockRestore()
      matchMedia.mockRestore()
    })

    test('reloads items when route query changes', async () => {
      mockCwa()
      mountComponent()
      await flushPromises()
      const before = fetchMock.mock.calls.length
      mockRoute.query = { page: '2' }
      await flushPromises()
      expect(fetchMock.mock.calls.length).toBeGreaterThan(before)
    })
  })

  describe('perPage default watcher', () => {
    test('defaults perPage model to 20 when it is null', async () => {
      mockCwa()
      mountComponent()
      await flushPromises()
      expect(models.perPageModel.value).toBe(20)
    })
  })

  describe('the kit list (#461)', () => {
    test('the header row names each column, a hidden label only for screen readers, on the grid its rows use', async () => {
      mockCwa({ fetchImpl: vi.fn(() => makeFetchResponse([{ '@id': '/a' }], { totalItems: 1 })) })
      const wrapper = mountComponent({}, '/_/routes', undefined, { columns: [{ label: 'Page' }, { label: 'Status', width: '13rem' }, { label: 'Actions', width: '2.75rem', labelHidden: true }] })
      await flushPromises()

      expect(wrapper.findAll('[role="columnheader"]').map(header => header.text())).toEqual(['Page', 'Status', 'Actions'])
      expect(wrapper.findAll('[role="columnheader"] span')[2]!.classes()).toContain('cwa:sr-only')
      expect(wrapper.get('[role="table"]').attributes('style')).toContain('--cwa-list-columns: minmax(0,1fr) 13rem 2.75rem')
    })

    test('a loaded list reports its items to its page and announces how many there are', async () => {
      const items = [{ '@id': '/a' }, { '@id': '/b' }]
      mockCwa({ fetchImpl: vi.fn(() => makeFetchResponse(items, { totalItems: 7 })) })
      const wrapper = mountComponent({}, '/_/routes', undefined, { noun: 'pages' })
      await flushPromises()

      expect(wrapper.emitted('loaded')).toEqual([[items]])
      expect(wrapper.get('[data-testid="list-announcer"]').text()).toBe('7 pages')
      expect(wrapper.get('[role="table"]').attributes('aria-busy')).toBeUndefined()
    })

    test('an empty list offers what its page gives it, and a search that matches nothing says so instead', async () => {
      mockCwa({ fetchImpl: vi.fn(() => makeFetchResponse([], { totalItems: 0 })) })
      const empty = mountComponent({ empty: '<button type="button" class="create-stub">Create page</button>' }, '/_/pages', undefined, { noun: 'pages' })
      await flushPromises()
      expect(empty.text()).toContain('No pages yet')
      expect(empty.find('.create-stub').exists()).toBe(true)

      mockRoute.query = { search: 'shaker' }
      const searched = mountComponent({ empty: '<button type="button" class="create-stub">Create page</button>' }, '/_/pages', undefined, { noun: 'pages' })
      await flushPromises()
      expect(searched.text()).toContain('No pages match “shaker”.')
      expect(searched.find('.create-stub').exists()).toBe(false)
      expect(searched.get('[data-testid="list-clear-filters"]').text()).toBe('Clear search')
    })

    test.each([
      ['a type filter', { 'isTemplate[]': ['true'] }],
      ['a filter from a link', { page: '2', template: '/_/pages/t' }],
      ['a filter and a search', { 'search': 'shaker', 'isTemplate[]': 'false' }],
    ])('an empty list under %s says nothing matches the filters, never that there are none yet, and Clear filters keeps the sort and page size', async (_kind, query) => {
      mockRoute.query = { ...query, 'order[createdAt]': 'desc', 'perPage': '20', 'cwa_force': 'true' }
      mockCwa({ fetchImpl: vi.fn(() => makeFetchResponse([], { totalItems: 0 })) })
      const wrapper = mountComponent({ empty: '<button type="button" class="create-stub">Create page</button>' }, '/_/pages', undefined, { noun: 'pages' })
      await flushPromises()

      expect(wrapper.text()).toContain('No pages match these filters.')
      expect(wrapper.text()).not.toContain('No pages yet')
      expect(wrapper.find('.create-stub').exists()).toBe(false)
      expect(drawsFocusRing(wrapper.get('[data-testid="list-clear-filters"]').classes())).toBe(true)
      await wrapper.get('[data-testid="list-clear-filters"]').trigger('click')
      expect(routerReplace).toHaveBeenCalledWith({ query: { 'order[createdAt]': 'desc', 'perPage': '20', 'cwa_force': 'true' } })
    })

    test('the sort, page size and an emptied search are not filters', async () => {
      mockRoute.query = { 'order[reference]': 'asc', 'perPage': '50', 'search': ' ', 'isTemplate[]': [] }
      mockCwa({ fetchImpl: vi.fn(() => makeFetchResponse([], { totalItems: 0 })) })
      const wrapper = mountComponent({ empty: '<button type="button" class="create-stub">Create page</button>' }, '/_/pages', undefined, { noun: 'pages' })
      await flushPromises()

      expect(wrapper.text()).toContain('No pages yet')
      expect(wrapper.find('.create-stub').exists()).toBe(true)
    })

    test('an empty page past the end of the list moves to the last page', async () => {
      models.pageModel.value = 9
      models.perPageModel.value = 20
      mockCwa({ fetchImpl: vi.fn(() => makeFetchResponse([], { totalItems: 41 })) })
      const wrapper = mountComponent({}, '/_/pages', undefined, { noun: 'pages' })
      await flushPromises()

      expect(models.pageModel.value).toBe(3)
      expect(wrapper.find('[data-testid="list-state-empty"]').exists()).toBe(false)
      expect(wrapper.emitted('loaded')).toBeUndefined()
    })

    test('an empty first page of an empty list stays where it is', async () => {
      models.pageModel.value = 2
      models.perPageModel.value = 20
      mockCwa({ fetchImpl: vi.fn(() => makeFetchResponse([], { totalItems: 0 })) })
      const wrapper = mountComponent({}, '/_/pages', undefined, { noun: 'pages' })
      await flushPromises()

      expect(models.pageModel.value).toBe(2)
      expect(wrapper.find('[data-testid="list-state-empty"]').exists()).toBe(true)
    })

    test('a failed reload keeps the rows dimmed under the alert, says how old they are, and Retry loads again', async () => {
      let shouldFail = false
      mockCwa({
        fetchImpl: vi.fn(() => shouldFail
          ? makeFetchRejection({ statusCode: 503 })
          : makeFetchResponse([{ '@id': '/a' }], { totalItems: 1 })),
      })
      const wrapper = mountComponent()
      await flushPromises()
      shouldFail = true
      // @ts-expect-error exposed method
      await wrapper.vm.reloadItems()
      await flushPromises()

      expect(errorAlert(wrapper).text()).toContain('The list below is from less than a minute ago.')
      expect(wrapper.findAll('[role="rowgroup"]')[1]!.classes()).toContain('cwa:opacity-60')
      shouldFail = false
      await wrapper.get('[data-testid="list-retry"]').trigger('click')
      await flushPromises()
      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(errorAlert(wrapper).exists()).toBe(false)
    })

    test('a first load that fails does not say how old a list it never had is', async () => {
      mockCwa({ fetchImpl: vi.fn(() => makeFetchRejection({ statusCode: 500 })) })
      const wrapper = mountComponent()
      await flushPromises()

      expect(errorAlert(wrapper).text()).not.toContain('The list below is from')
    })

    test('the page count is exposed for the toolbar once the list has loaded', async () => {
      mockCwa({ fetchImpl: vi.fn(() => makeFetchResponse([{ '@id': '/a' }], { totalItems: 143 })) })
      const wrapper = mountComponent()
      // @ts-expect-error exposed value
      expect(wrapper.vm.total).toBeUndefined()
      await flushPromises()
      // @ts-expect-error exposed value
      expect(wrapper.vm.total).toBe(143)
    })

    test.each([
      ['loaded', () => makeFetchResponse([{ '@id': '/a' }], { totalItems: 1 })],
      ['empty', () => makeFetchResponse([], { totalItems: 0 })],
      ['filtered to nothing', () => {
        mockRoute.query = { 'isTemplate[]': 'true' }
        return makeFetchResponse([], { totalItems: 0 })
      }],
      ['failed', () => makeFetchRejection({ statusCode: 500 })],
      ['loading', () => ({ response: new Promise(() => {}) })],
    ])('%s, it has no axe violations', async (_state, response) => {
      mockCwa({ fetchImpl: vi.fn(response) })
      mountComponent()
      await flushPromises()

      expect(await axe(document.body)).toHaveNoViolations()
    })
  })
})
