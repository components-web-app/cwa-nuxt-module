// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { consola } from 'consola'
import ListContent from './ListContent.vue'
import * as cwaComposable from '#cwa/composables/cwa'

vi.mock('consola')

// eslint-disable-next-line no-var
var mockRoute: { query: Record<string, any> }
vi.mock('vue-router', async () => {
  const { reactive } = await import('vue')
  mockRoute = reactive({ query: {} as Record<string, any> })
  const mod = await vi.importActual<typeof import('vue-router')>('vue-router')
  return { ...mod, useRoute: () => mockRoute, useRouter: () => ({ replace: vi.fn() }) }
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

const ListContainerStub = { template: '<div class="list-container-stub"><slot /></div>' }
const ListPaginationStub = {
  name: 'ListPagination',
  props: ['page', 'perPage', 'totalItems'],
  template: '<div class="list-pagination-stub" />',
}
const SpinnerStub = { name: 'Spinner', props: ['show'], template: '<div class="spinner-stub" />' }
const CwaUiIconWarningIconStub = { name: 'CwaUiIconWarningIcon', template: '<svg class="warning-icon-stub" />' }
const CwaUiAlertWarningStub = { name: 'CwaUiAlertWarning', template: '<div class="alert-stub"><slot /></div>' }

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

function mountComponent(slots: Record<string, any> = {}, fetchUrl = '/_/routes', searchFields?: string[]) {
  return mount(ListContent, {
    props: { fetchUrl, searchFields },
    global: {
      stubs: {
        ListContainer: ListContainerStub,
        ListPagination: ListPaginationStub,
        Spinner: SpinnerStub,
        CwaUiIconWarningIcon: CwaUiIconWarningIconStub,
        CwaUiAlertWarning: CwaUiAlertWarningStub,
      },
    },
    slots,
  })
}

describe('ListContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoute.query = {}
    if (models.pageModel) models.pageModel.value = 1
    if (models.perPageModel) models.perPageModel.value = null
  })

  test('shows the spinner while loading on initial mount', () => {
    mockCwa({ fetchImpl: vi.fn(() => ({ response: new Promise(() => {}) })) })
    const wrapper = mountComponent()
    expect(wrapper.findComponent(SpinnerStub).exists()).toBe(true)
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
    expect(wrapper.findComponent(SpinnerStub).exists()).toBe(false)
    expect(wrapper.text()).toContain('Sorry, no items found')
    expect(wrapper.findComponent(CwaUiIconWarningIconStub).exists()).toBe(true)
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
    expect(wrapper.findAll('li')).toHaveLength(3)
    const paginations = wrapper.findAllComponents(ListPaginationStub)
    expect(paginations).toHaveLength(2)
    expect(paginations[0].props('totalItems')).toBe(42)
  })

  test('passes totalItems=0 to pagination when result has no totalItems', async () => {
    mockCwa({ fetchImpl: vi.fn(() => makeFetchResponse([{ '@id': '/a' }])) })
    const wrapper = mountComponent()
    await flushPromises()
    await nextTick()
    expect(wrapper.findAllComponents(ListPaginationStub)[0].props('totalItems')).toBe(0)
  })

  test('renders the default "no template" UI when no item slot is provided', async () => {
    mockCwa({ fetchImpl: vi.fn(() => makeFetchResponse([{ '@id': '/a' }])) })
    const wrapper = mountComponent()
    await flushPromises()
    await nextTick()
    expect(wrapper.text()).toContain('No list item template UI provided')
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
    expect(wrapper.findComponent(SpinnerStub).exists()).toBe(false)
    expect(wrapper.text()).toContain('Sorry, no items found')
  })

  describe('failed load', () => {
    test('the spinner stops when the list fails to load', async () => {
      mockCwa({ fetchImpl: vi.fn(() => makeFetchRejection({ statusCode: 422 })) })
      const wrapper = mountComponent()
      await flushPromises()
      await nextTick()
      expect(wrapper.findComponent(SpinnerStub).exists()).toBe(false)
    })

    test('a failure is reported in an alert with the status code', async () => {
      mockCwa({ fetchImpl: vi.fn(() => makeFetchRejection({ statusCode: 422 })) })
      const wrapper = mountComponent()
      await flushPromises()
      await nextTick()
      const alert = wrapper.findComponent(CwaUiAlertWarningStub)
      expect(alert.exists()).toBe(true)
      expect(alert.text()).toBe('The list could not be loaded (422). Please try again.')
    })

    test('a failure with no status code is reported as a network error', async () => {
      mockCwa({ fetchImpl: vi.fn(() => makeFetchRejection(new Error('fetch failed'))) })
      const wrapper = mountComponent()
      await flushPromises()
      await nextTick()
      expect(wrapper.findComponent(CwaUiAlertWarningStub).text()).toBe('The list could not be loaded (network error). Please try again.')
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
      expect(wrapper.text()).not.toContain('Sorry, no items found')
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
      expect(wrapper.findAll('li')).toHaveLength(2)

      shouldFail = true
      // @ts-expect-error exposed method
      await wrapper.vm.reloadItems()
      await flushPromises()
      await nextTick()
      expect(wrapper.findComponent(CwaUiAlertWarningStub).exists()).toBe(true)
      expect(wrapper.findAll('li')).toHaveLength(2)
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
      expect(wrapper.findComponent(CwaUiAlertWarningStub).exists()).toBe(true)

      shouldFail = false
      // @ts-expect-error exposed method
      await wrapper.vm.reloadItems()
      await flushPromises()
      await nextTick()
      expect(wrapper.findComponent(CwaUiAlertWarningStub).exists()).toBe(false)
      expect(wrapper.findAll('li')).toHaveLength(1)
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

      expect(wrapper.findAllComponents(ListPaginationStub)[0].props('totalItems')).toBe(999)
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

      expect(wrapper.findComponent(SpinnerStub).exists()).toBe(true)
      expect(wrapper.findComponent(CwaUiAlertWarningStub).exists()).toBe(false)
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

      expect(wrapper.findComponent(CwaUiAlertWarningStub).exists()).toBe(false)
      expect(wrapper.findAll('li')).toHaveLength(1)
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

      expect(wrapper.findComponent(CwaUiAlertWarningStub).exists()).toBe(true)
      expect(wrapper.findAll('li')).toHaveLength(0)
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
    test('defaults perPage model to 5 when it is null', async () => {
      mockCwa()
      mountComponent()
      await flushPromises()
      expect(models.perPageModel.value).toBe(5)
    })
  })
})
