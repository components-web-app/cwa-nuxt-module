// @vitest-environment nuxt
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import PageDataAdminModal from './PageDataAdminModal.vue'
import * as cwaComposable from '#cwa/composables/cwa'

const { mockUseItemPage, mockUseDynamicPageLoader, mockUseParentPageLoader, mockUseDataType, mockUseDataList } = vi.hoisted(() => ({
  mockUseItemPage: vi.fn(),
  mockUseDynamicPageLoader: vi.fn(),
  mockUseParentPageLoader: vi.fn(),
  mockUseDataType: vi.fn(),
  mockUseDataList: vi.fn(),
}))

vi.mock('#cwa-layer/pages/_cwa/index/composables/useItemPage', () => ({ useItemPage: mockUseItemPage }))
vi.mock('#cwa-layer/pages/_cwa/index/composables/useDynamicPageLoader', () => ({ useDynamicPageLoader: mockUseDynamicPageLoader }))
vi.mock('#cwa-layer/pages/_cwa/index/composables/useParentPageLoader', () => ({ useParentPageLoader: mockUseParentPageLoader }))
vi.mock('#cwa-layer/pages/_cwa/index/composables/useDataType', () => ({ useDataType: mockUseDataType }))
vi.mock('#cwa-layer/pages/_cwa/index/composables/useDataList', () => ({ useDataList: mockUseDataList }))

const mockDynamicPages = [
  { '@id': '/_/pages/template-1', 'reference': 'ConferenceTemplate', 'isTemplate': true },
]
const mockParentPages = [
  { '@id': '/_/pages/uuid-1', 'reference': 'Home' },
  { '@id': '/_/pages/uuid-2', 'reference': 'Conference' },
]

function setup(
  localDataOverrides: Record<string, any> = {},
  getResource: (iri: string) => any = () => ref(null),
) {
  const localResourceData = ref({
    '@id': '/_/abstract_page_data/uuid-self',
    'title': 'My Data Page',
    'metaDescription': '',
    'page': '/_/pages/template-1',
    'parentPage': null,
    ...localDataOverrides,
  })

  mockUseItemPage.mockReturnValue({
    isAdding: ref(false),
    isLoading: ref(false),
    isUpdating: ref(false),
    localResourceData,
    resource: ref({ '@id': '/_/abstract_page_data/uuid-self', '@type': 'ConferenceData', 'route': null }),
    formatDate: vi.fn(() => '2026-01-01'),
    deleteResource: vi.fn(),
    saveResource: vi.fn(),
    saveTitle: vi.fn(),
    loadResource: vi.fn(),
    getInternalResourceLink: vi.fn(() => ({ name: '_cwa-index-data-type-iri', params: {} })),
  })

  mockUseDynamicPageLoader.mockReturnValue({
    dynamicPages: ref(mockDynamicPages),
    loadDynamicPageOptions: vi.fn(),
  })

  mockUseParentPageLoader.mockReturnValue({
    parentPages: ref(mockParentPages),
    loadParentPageOptions: vi.fn(),
  })

  mockUseDataType.mockReturnValue({ pageDataConfig: ref(null) })
  mockUseDataList.mockReturnValue({ fqcnToEntrypointKey: vi.fn((t: string) => t) })

  // @ts-expect-error
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    resources: { pageData: ref(null), isDataPage: ref(false), getResource: vi.fn(getResource) },
    fetch: vi.fn().mockReturnValue({ response: Promise.resolve({ _data: null }) }),
    getApiDocumentation: vi.fn().mockResolvedValue(null),
    admin: { toggleEdit: vi.fn() },
  }))

  return mount(PageDataAdminModal, {
    props: { iri: '/_/abstract_page_data/uuid-self', resourceType: 'App\\Entity\\ConferenceData' },
    shallow: true,
    global: {
      stubs: {
        ResourceModalTabs: {
          props: ['tabs'],
          template: '<div><slot name="details" /><slot name="routes" /><slot name="info" /></div>',
        },
        ResourceModal: {
          template: '<div><slot /><slot name="title" /></div>',
        },
      },
    },
  })
}

describe('PageDataAdminModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Parent Page picker', () => {
    test('renders a "Parent Page" ModalSelect', () => {
      const wrapper = setup()
      const selects = wrapper.findAllComponents({ name: 'ModalSelect' })
      const parentSelect = selects.find(s => s.props('label') === 'Parent Page')
      expect(parentSelect?.exists()).toBe(true)
    })

    test('Parent Page options include a null "None" option and all pages', () => {
      const wrapper = setup()
      const selects = wrapper.findAllComponents({ name: 'ModalSelect' })
      const parentSelect = selects.find(s => s.props('label') === 'Parent Page')
      const options = parentSelect?.props('options') as Array<{ label: string, value: string | null }>
      expect(options).toContainEqual({ label: 'None', value: null })
      expect(options).toContainEqual({ label: 'Conference', value: '/_/pages/uuid-2' })
    })
  })

  describe('Dynamic Page field visibility', () => {
    test('shows "Dynamic Page" select when parentPage is not set', () => {
      const wrapper = setup({ parentPage: null })
      const selects = wrapper.findAllComponents({ name: 'ModalSelect' })
      const labels = selects.map(s => s.props('label'))
      expect(labels).toContain('Dynamic Page')
    })

    test('hides "Dynamic Page" select when parentPage is set', () => {
      const wrapper = setup({ parentPage: '/_/pages/uuid-2' })
      const selects = wrapper.findAllComponents({ name: 'ModalSelect' })
      const labels = selects.map(s => s.props('label'))
      expect(labels).not.toContain('Dynamic Page')
    })
  })

  describe('depth switcher', () => {
    test('shows a "Viewing" ModalSelect when the resource chain has parents in the store', () => {
      const wrapper = setup({}, (iri) => {
        if (iri === '/_/abstract_page_data/uuid-self') return ref({ data: { title: 'Programme Data', parentPage: '/_/pages/uuid-2' } })
        if (iri === '/_/pages/uuid-2') return ref({ data: { reference: 'Conference', parentPage: null } })
        return ref(null)
      })
      const selects = wrapper.findAllComponents({ name: 'ModalSelect' })
      expect(selects.find(s => s.props('label') === 'Viewing')?.exists()).toBe(true)
    })

    test('depth options include the current data page and its parent', () => {
      const wrapper = setup({}, (iri) => {
        if (iri === '/_/abstract_page_data/uuid-self') return ref({ data: { title: 'Programme Data', parentPage: '/_/pages/uuid-2' } })
        if (iri === '/_/pages/uuid-2') return ref({ data: { reference: 'Conference', parentPage: null } })
        return ref(null)
      })
      const selects = wrapper.findAllComponents({ name: 'ModalSelect' })
      const depthSelect = selects.find(s => s.props('label') === 'Viewing')
      const options = depthSelect?.props('options') as Array<{ label: string, value: string }>
      expect(options).toContainEqual({ label: 'Programme Data', value: '/_/abstract_page_data/uuid-self' })
      expect(options).toContainEqual({ label: 'Conference', value: '/_/pages/uuid-2' })
    })

    test('does not show depth switcher when the resource has no parents', () => {
      const wrapper = setup({}, (iri) => {
        if (iri === '/_/abstract_page_data/uuid-self') return ref({ data: { title: 'My Data', parentPage: null } })
        return ref(null)
      })
      const selects = wrapper.findAllComponents({ name: 'ModalSelect' })
      expect(selects.some(s => s.props('label') === 'Viewing')).toBe(false)
    })
  })
})
