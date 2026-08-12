// @vitest-environment nuxt
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import PageResourceAdminModal from './PageResourceAdminModal.vue'
import * as cwaComposable from '#cwa/composables/cwa'

const mockNavigateTo = vi.hoisted(() => vi.fn())
mockNuxtImport('navigateTo', () => mockNavigateTo)

const { mockUseItemPage, mockUseDynamicPageLoader, mockUseParentPageLoader, mockUseParentPageDataLoader, mockUseDataType } = vi.hoisted(() => ({
  mockUseItemPage: vi.fn(),
  mockUseDynamicPageLoader: vi.fn(),
  mockUseParentPageLoader: vi.fn(),
  mockUseParentPageDataLoader: vi.fn(),
  mockUseDataType: vi.fn(),
}))

vi.mock('#cwa-layer/pages/_cwa/index/composables/useItemPage', () => ({ useItemPage: mockUseItemPage }))
vi.mock('#cwa-layer/pages/_cwa/index/composables/useDynamicPageLoader', () => ({ useDynamicPageLoader: mockUseDynamicPageLoader }))
vi.mock('#cwa-layer/pages/_cwa/index/composables/useParentPageLoader', () => ({ useParentPageLoader: mockUseParentPageLoader }))
vi.mock('#cwa-layer/pages/_cwa/index/composables/useParentPageDataLoader', () => ({ useParentPageDataLoader: mockUseParentPageDataLoader }))
vi.mock('#cwa-layer/pages/_cwa/index/composables/useDataType', () => ({ useDataType: mockUseDataType }))

function setup(opts: {
  iri?: string
  resourceType?: string
  resource?: any
  displayPageIri?: string | undefined
  fqcnToEntrypointKey?: (t: string) => any
} = {}) {
  const iri = opts.iri ?? '/_/pages/uuid-self'
  const localResourceData = ref({
    '@id': iri,
    'reference': 'My Page',
    'title': '',
    'metaDescription': '',
    'parentPage': null,
    'parentPageData': null,
  })

  const handlers = {
    isAdding: ref(false),
    isLoading: ref(false),
    isUpdating: ref(false),
    localResourceData,
    resource: ref(opts.resource ?? { '@id': iri, '@type': 'Page' }),
    formatDate: vi.fn(() => '2026-01-01'),
    deleteResource: vi.fn(),
    saveResource: vi.fn(),
    saveTitle: vi.fn(),
    loadResource: vi.fn(),
    getInternalResourceLink: vi.fn((resourceIri: string) => ({ name: '_cwa-pages-iri', params: { iri: resourceIri } })),
  }
  mockUseItemPage.mockReturnValue(handlers)

  mockUseDynamicPageLoader.mockReturnValue({ dynamicPages: ref([]), loadDynamicPageOptions: vi.fn() })
  mockUseParentPageLoader.mockReturnValue({ parentPages: ref([]), loadParentPageOptions: vi.fn() })
  mockUseParentPageDataLoader.mockReturnValue({
    dataTypes: ref([]),
    dataInstances: ref([]),
    loadDataTypes: vi.fn(),
    loadDataInstances: vi.fn(),
    fqcnToEntrypointKey: vi.fn(opts.fqcnToEntrypointKey ?? ((t: string) => t)),
  })
  mockUseDataType.mockReturnValue({ pageDataConfig: ref(null) })

  // @ts-expect-error
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    resources: {
      displayPageIri: ref(opts.displayPageIri),
      getResource: vi.fn(() => ref(null)),
    },
    fetch: vi.fn().mockReturnValue({ response: Promise.resolve({ _data: null }) }),
    pagesConfig: {},
    admin: { toggleEdit: vi.fn() },
  }))

  const wrapper = mount(PageResourceAdminModal, {
    props: { iri, resourceType: opts.resourceType ?? 'Page' },
    shallow: true,
    global: {
      stubs: {
        ResourceModalTabs: {
          name: 'ResourceModalTabs',
          props: ['tabs'],
          template: '<div><slot name="details" /><slot name="routes" /><slot name="info" /></div>',
        },
        ResourceModal: {
          name: 'ResourceModal',
          emits: ['close', 'save'],
          template: '<div><slot name="icons" /><slot name="subheader" /><slot /><slot name="title" /></div>',
        },
      },
    },
  })

  return { wrapper, handlers }
}

async function clickDelete(wrapper: ReturnType<typeof setup>['wrapper']) {
  const buttons = wrapper.findAllComponents({ name: 'CwaUiFormButton' })
  await buttons[buttons.length - 1].vm.$emit('click')
}

describe('PageResourceAdminModal delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('navigates to the pages admin listing when deleting the page currently on screen', async () => {
    const { wrapper, handlers } = setup({ displayPageIri: '/_/pages/uuid-self' })
    await clickDelete(wrapper)
    expect(handlers.deleteResource).toHaveBeenCalled()

    // must navigate from requestCompleteFn (2nd arg) - it runs before the resource is removed from
    // the store, unlike saveCompleteFn which would leave the user on a page that no longer exists
    const requestCompleteFn = handlers.deleteResource.mock.calls[0][1]
    expect(requestCompleteFn).toBeInstanceOf(Function)
    await requestCompleteFn()
    expect(mockNavigateTo).toHaveBeenCalledWith({ name: '_cwa-pages', query: { cwa_force: 'true' } })
  })

  test('navigates to the typed data listing when the page on screen is a data page', async () => {
    const { wrapper, handlers } = setup({
      iri: '/_/page_data/uuid-self',
      resourceType: 'App\\Entity\\EventData',
      resource: { '@id': '/_/page_data/uuid-self', '@type': 'App\\Entity\\EventData' },
      displayPageIri: '/_/page_data/uuid-self',
      fqcnToEntrypointKey: (t: string) => t === 'App\\Entity\\EventData' ? 'event_data' : null,
    })
    await clickDelete(wrapper)
    const requestCompleteFn = handlers.deleteResource.mock.calls[0][1]
    await requestCompleteFn()
    expect(mockNavigateTo).toHaveBeenCalledWith({ name: '_cwa-data-type', params: { type: 'event_data' }, query: { cwa_force: 'true' } })
  })

  test('falls back to the data listing when the data type has no entrypoint key', async () => {
    const { wrapper, handlers } = setup({
      iri: '/_/page_data/uuid-self',
      resourceType: 'App\\Entity\\EventData',
      resource: { '@id': '/_/page_data/uuid-self', '@type': 'App\\Entity\\EventData' },
      displayPageIri: '/_/page_data/uuid-self',
      fqcnToEntrypointKey: () => null,
    })
    await clickDelete(wrapper)
    const requestCompleteFn = handlers.deleteResource.mock.calls[0][1]
    await requestCompleteFn()
    expect(mockNavigateTo).toHaveBeenCalledWith({ name: '_cwa-data', query: { cwa_force: 'true' } })
  })

  test('does not navigate when deleting a page we are not currently viewing', async () => {
    const { wrapper, handlers } = setup({ displayPageIri: undefined })
    await clickDelete(wrapper)
    expect(handlers.deleteResource).toHaveBeenCalledWith()
    expect(mockNavigateTo).not.toHaveBeenCalled()
  })
})
