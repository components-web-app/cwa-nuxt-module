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

function mockCwa() {
  const store = reactive<Record<string, any>>({
    [childPageIri]: { data: childPage, apiState: { status: 'SUCCESS' } },
    [conferenceIri]: { data: conference, apiState: { status: 'SUCCESS' } },
  })
  const createResource = vi.fn().mockResolvedValue({ '@id': '/_/routes//2027', 'path': '/2027' })
  // @ts-expect-error
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    resources: {
      getResource: vi.fn((iri: string) => computed(() => store[iri])),
      isDataPage: computed(() => false),
      pageDataIri: computed(() => undefined),
      pageIri: computed(() => undefined),
    },
    resourcesManager: { createResource, updateResource: vi.fn(), deleteResource: vi.fn(), addError: vi.fn() },
    fetchResource: vi.fn(),
    fetch: vi.fn(() => ({ response: Promise.resolve({ _data: { children: [] } }) })),
  }))
  return { createResource }
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
    })
    await flushPromises()

    await wrapper.setProps({ pageResource: conference as any })
    await flushPromises()

    await wrapper.findComponent(RoutesTabView).vm.$emit('changePage', 'manage-route')
    await wrapper.findComponent(RoutesTabManage).vm.$emit('update:modelValue', '/2027')
    await wrapper.findComponent(RoutesTabManage).vm.$emit('save')
    await flushPromises()

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
    })
    await flushPromises()

    await wrapper.findComponent(RoutesTabView).vm.$emit('changePage', 'manage-route')
    await wrapper.findComponent(RoutesTabManage).vm.$emit('update:modelValue', '/2027')
    await wrapper.findComponent(RoutesTabManage).vm.$emit('save')
    await flushPromises()
    expect(wrapper.findComponent(RoutesTabView).props('isLoading')).toBe(true)

    await wrapper.setProps({ pageResource: { ...conference, route: '/_/routes//2027' } as any })
    await flushPromises()
    expect(wrapper.findComponent(RoutesTabView).props('isLoading')).toBe(false)
  })
})
