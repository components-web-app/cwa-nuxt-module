// @vitest-environment nuxt
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { computed, reactive } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import RoutesTab from './RoutesTab.vue'
import RoutesTabView from './RoutesTabView.vue'
import RoutesTabManage from './RoutesTabManage.vue'
import * as cwaComposable from '#cwa/composables/cwa'

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }))

vi.mock('vue-router', async (importOriginal) => {
  const mod = await importOriginal<typeof import('vue-router')>()
  return {
    ...mod,
    useRoute: () => ({ name: '_cwa-resource-page', params: {}, query: {}, hash: '' }),
    useRouter: () => ({ push: mockPush }),
  }
})

vi.mock('vuejs-confirm-dialog', () => ({
  install: vi.fn(),
  createConfirmDialog: vi.fn(() => ({ reveal: vi.fn().mockResolvedValue({ isCanceled: true }) })),
}))

const childPageIri = '/_/pages/overview-uuid'
const conferenceIri = '/_/page_data/conference_datas/conference-uuid'

const childPage = {
  '@id': childPageIri,
  '@type': 'Page',
  'reference': '2027-overview',
  'parentPage': null,
  'parentPageData': conferenceIri,
}

const conference = {
  '@id': conferenceIri,
  '@type': 'ConferenceData',
  'title': '2027 Annual SRNT-E Conference',
  'parentPage': null,
  'parentPageData': null,
}

function mockCwa(extra: Record<string, any> = {}) {
  const store = reactive<Record<string, any>>({
    [childPageIri]: { data: childPage, apiState: { status: 'SUCCESS' } },
    [conferenceIri]: { data: conference, apiState: { status: 'SUCCESS' } },
    ...extra,
  })
  const createResource = vi.fn().mockResolvedValue({ '@id': '/_/routes//2027', 'path': '/2027' })
  const updateResource = vi.fn().mockResolvedValue({ '@id': '/_/routes//2027', 'path': '/2027' })
  // @ts-expect-error
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    resources: {
      getResource: vi.fn((iri: string) => computed(() => store[iri])),
      isDataPage: computed(() => false),
      pageDataIri: computed(() => undefined),
      pageIri: computed(() => undefined),
    },
    resourcesManager: { createResource, updateResource, deleteResource: vi.fn(), addError: vi.fn() },
    fetchResource: vi.fn(),
    fetch: vi.fn(() => ({ response: Promise.resolve({ _data: { children: [] } }) })),
  }))
  return { createResource, updateResource }
}

const subViewStub = { template: '<div><slot name="main" /><slot /></div>' }

function saveButton(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAllComponents({ name: 'CwaUiButton' }).find(button => ['Save route', 'Add route'].includes(button.props('label')))!
}

async function openRoute(wrapper: ReturnType<typeof mount>) {
  await wrapper.findComponent(RoutesTabView).vm.$emit('open', 'route')
  await flushPromises()
}

async function save(wrapper: ReturnType<typeof mount>) {
  await saveButton(wrapper).vm.$emit('click')
  await flushPromises()
}

describe('RoutesTab route binding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('nested child under a data page: a route created after switching the modal to the parent is bound to the parent page data', async () => {
    const { createResource } = mockCwa()
    const wrapper = mount(RoutesTab, {
      props: { pageResource: childPage as any },
      shallow: true,
      global: { stubs: { CwaUiSubView: subViewStub } },
    })
    await flushPromises()

    await wrapper.setProps({ pageResource: conference as any })
    await flushPromises()

    await openRoute(wrapper)
    await wrapper.findComponent(RoutesTabManage).vm.$emit('update:modelValue', '/2027')
    await save(wrapper)

    expect(createResource).toHaveBeenCalledOnce()
    const { endpoint, data } = createResource.mock.calls[0]![0]
    expect(endpoint).toBe('/_/routes')
    expect(data.path).toBe('/2027')
    expect(data.pageData).toBe(conferenceIri)
    expect(data.page).toBeUndefined()
  })

  test('the loading state clears once the parent page takes up the route it was given', async () => {
    mockCwa()
    const wrapper = mount(RoutesTab, {
      props: { pageResource: conference as any },
      shallow: true,
      global: { stubs: { CwaUiSubView: subViewStub } },
    })
    await flushPromises()

    await openRoute(wrapper)
    await wrapper.findComponent(RoutesTabManage).vm.$emit('update:modelValue', '/2027')
    await save(wrapper)
    expect(wrapper.findComponent(RoutesTabView).props('isLoading')).toBe(true)

    await wrapper.setProps({ pageResource: { ...conference, route: '/_/routes//2027' } as any })
    await flushPromises()
    expect(wrapper.findComponent(RoutesTabView).props('isLoading')).toBe(false)
  })

  test('saving the go-live date on a parent route that redirects to a child does not send the child\'s borrowed page', async () => {
    const parentRouteIri = '/_/routes//2027'
    const { updateResource } = mockCwa({
      [parentRouteIri]: {
        data: {
          '@id': parentRouteIri,
          '@type': 'Route',
          'name': '/2027',
          'path': '/2027',
          'pageData': conferenceIri,
          'page': childPageIri,
          'redirect': '/_/routes//2027/overview',
        },
        apiState: { status: 'SUCCESS', path: `${parentRouteIri}/redirects` },
      },
    })
    const wrapper = mount(RoutesTab, {
      props: { pageResource: { ...conference, route: parentRouteIri } as any },
      shallow: true,
      global: { stubs: { CwaUiSubView: subViewStub } },
    })
    await flushPromises()

    await openRoute(wrapper)
    await wrapper.findComponent(RoutesTabManage).vm.$emit('update:liveAt', '2027-03-01T09:00:00+00:00')
    await save(wrapper)

    expect(updateResource).toHaveBeenCalledOnce()
    expect(updateResource.mock.calls[0]![0]).toEqual({
      endpoint: parentRouteIri,
      data: { liveAt: '2027-03-01T09:00:00+00:00' },
      onRequest: expect.any(Function),
    })
  })

  test('saving a live route the editor left untouched sends no request at all', async () => {
    const routeIri = '/_/routes//2027'
    const { updateResource } = mockCwa({
      [routeIri]: {
        data: {
          '@id': routeIri,
          '@type': 'Route',
          'name': '/2027',
          'path': '/2027',
          'pageData': conferenceIri,
          'liveAt': '2020-01-01T00:00:00+00:00',
        },
        apiState: { status: 'SUCCESS', path: `${routeIri}/redirects` },
      },
    })
    const wrapper = mount(RoutesTab, {
      props: { pageResource: { ...conference, route: routeIri } as any },
      shallow: true,
      global: { stubs: { CwaUiSubView: subViewStub } },
    })
    await flushPromises()

    await openRoute(wrapper)
    expect(saveButton(wrapper).props('disabled')).toBe(true)
    await save(wrapper)

    expect(updateResource).not.toHaveBeenCalled()
  })

  test('creating a route for a page still sends the full body including the page', async () => {
    const page = { '@id': '/_/pages/standalone-uuid', '@type': 'Page', 'reference': 'standalone', 'parentPage': null, 'parentPageData': null }
    const { createResource } = mockCwa({ [page['@id']]: { data: page, apiState: { status: 'SUCCESS' } } })
    const wrapper = mount(RoutesTab, {
      props: { pageResource: page as any },
      shallow: true,
      global: { stubs: { CwaUiSubView: subViewStub } },
    })
    await flushPromises()

    await openRoute(wrapper)
    await wrapper.findComponent(RoutesTabManage).vm.$emit('update:modelValue', '/standalone')
    await save(wrapper)

    expect(createResource).toHaveBeenCalledOnce()
    expect(createResource.mock.calls[0]![0].data).toEqual({
      '@type': 'Route',
      'path': '/standalone',
      'name': '/standalone',
      'page': page['@id'],
    })
  })
})
