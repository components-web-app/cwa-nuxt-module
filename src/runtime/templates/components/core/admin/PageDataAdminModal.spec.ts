// @vitest-environment nuxt
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import PageDataAdminModal from './PageDataAdminModal.vue'
import * as cwaComposable from '#cwa/composables/cwa'

const mockNavigateTo = vi.hoisted(() => vi.fn())
mockNuxtImport('navigateTo', () => mockNavigateTo)

const { mockUseItemPage, mockUseDynamicPageLoader, mockUseParentPageLoader, mockUseParentPageDataLoader, mockUseDataType, mockUseDataList } = vi.hoisted(() => ({
  mockUseItemPage: vi.fn(),
  mockUseDynamicPageLoader: vi.fn(),
  mockUseParentPageLoader: vi.fn(),
  mockUseParentPageDataLoader: vi.fn(),
  mockUseDataType: vi.fn(),
  mockUseDataList: vi.fn(),
}))

vi.mock('#cwa-layer/pages/_cwa/index/composables/useItemPage', () => ({ useItemPage: mockUseItemPage }))
vi.mock('#cwa-layer/pages/_cwa/index/composables/useDynamicPageLoader', () => ({ useDynamicPageLoader: mockUseDynamicPageLoader }))
vi.mock('#cwa-layer/pages/_cwa/index/composables/useParentPageLoader', () => ({ useParentPageLoader: mockUseParentPageLoader }))
vi.mock('#cwa-layer/pages/_cwa/index/composables/useParentPageDataLoader', () => ({ useParentPageDataLoader: mockUseParentPageDataLoader }))
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
    'parentPageData': null,
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

  mockUseParentPageDataLoader.mockReturnValue({
    dataTypes: ref([]),
    dataInstances: ref([]),
    loadDataTypes: vi.fn(),
    loadDataInstances: vi.fn(),
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
          template: '<div><slot name="subheader" /><slot /><slot name="title" /></div>',
        },
      },
    },
  })
}

// Advanced setup that returns access to the mocked item-page handlers, refs and the
// useCwa mock so tests can assert on wrapper functions (saveResource, goToTemplate, etc).
function setupAdvanced(opts: {
  localDataOverrides?: Record<string, any>
  itemPageOverrides?: Record<string, any>
  dataTypes?: any[]
  dataInstances?: any[]
  dynamicPages?: any[]
  pageDataConfig?: any
  pageData?: any
  getResource?: (iri: string) => any
  fqcnToEntrypointKey?: (t: string) => any
  resource?: any
  props?: Record<string, any>
} = {}) {
  const localResourceData = ref({
    '@id': '/_/abstract_page_data/uuid-self',
    'title': 'My Data Page',
    'metaDescription': '',
    'page': '/_/pages/template-1',
    'parentPage': null,
    'parentPageData': null,
    ...opts.localDataOverrides,
  })

  const handlers = {
    isAdding: ref(false),
    isLoading: ref(false),
    isUpdating: ref(false),
    localResourceData,
    resource: ref(opts.resource ?? { '@id': '/_/abstract_page_data/uuid-self', '@type': 'ConferenceData', 'route': null }),
    formatDate: vi.fn(() => '2026-01-01'),
    deleteResource: vi.fn(),
    saveResource: vi.fn(),
    saveTitle: vi.fn(),
    loadResource: vi.fn(),
    getInternalResourceLink: vi.fn((iri: string) => ({ name: '_cwa-index-data-type-iri', params: { iri } })),
    ...opts.itemPageOverrides,
  }
  mockUseItemPage.mockReturnValue(handlers)

  mockUseDynamicPageLoader.mockReturnValue({
    dynamicPages: ref(opts.dynamicPages ?? mockDynamicPages),
    loadDynamicPageOptions: vi.fn(),
  })
  mockUseParentPageLoader.mockReturnValue({
    parentPages: ref(mockParentPages),
    loadParentPageOptions: vi.fn(),
  })

  const loadDataInstances = vi.fn()
  mockUseParentPageDataLoader.mockReturnValue({
    dataTypes: ref(opts.dataTypes ?? []),
    dataInstances: ref(opts.dataInstances ?? []),
    loadDataTypes: vi.fn(),
    loadDataInstances,
  })

  mockUseDataType.mockReturnValue({ pageDataConfig: ref(opts.pageDataConfig ?? null) })
  mockUseDataList.mockReturnValue({ fqcnToEntrypointKey: vi.fn(opts.fqcnToEntrypointKey ?? ((t: string) => t)) })

  const toggleEdit = vi.fn()
  // @ts-expect-error
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    resources: { pageData: ref(opts.pageData ?? null), isDataPage: ref(false), getResource: vi.fn(opts.getResource ?? (() => ref(null))) },
    fetch: vi.fn().mockReturnValue({ response: Promise.resolve({ _data: null }) }),
    getApiDocumentation: vi.fn().mockResolvedValue(null),
    admin: { toggleEdit },
  }))

  const wrapper = mount(PageDataAdminModal, {
    props: { iri: '/_/abstract_page_data/uuid-self', resourceType: 'App\\Entity\\ConferenceData', ...opts.props },
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

  return { wrapper, handlers, localResourceData, loadDataInstances, toggleEdit }
}

describe('PageDataAdminModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Parent picker tab radio', () => {
    test('renders a ModalRadioTabs for selecting parent type', () => {
      const wrapper = setup()
      expect(wrapper.findComponent({ name: 'ModalRadioTabs' }).exists()).toBe(true)
    })

    test('ModalRadioTabs has None/Page/Data options', () => {
      const wrapper = setup()
      const tabs = wrapper.findComponent({ name: 'ModalRadioTabs' })
      const options = tabs.props('options') as Array<{ label: string, value: string | null }>
      expect(options.map(o => o.label)).toEqual(['None', 'Page', 'Data'])
    })

    test('shows "Parent Page" ModalSelect when parentType is "page" (parentPage is set)', () => {
      const wrapper = setup({ parentPage: '/_/pages/uuid-2' })
      const selects = wrapper.findAllComponents({ name: 'ModalSelect' })
      expect(selects.some(s => s.props('label') === 'Parent Page')).toBe(true)
    })

    test('hides "Parent Page" ModalSelect when parentType is none', () => {
      const wrapper = setup({ parentPage: null })
      const selects = wrapper.findAllComponents({ name: 'ModalSelect' })
      expect(selects.some(s => s.props('label') === 'Parent Page')).toBe(false)
    })

    test('clicking "Page" tab shows the Parent Page dropdown even when parentPage is initially null', async () => {
      const wrapper = setup({ parentPage: null })
      expect(wrapper.findAllComponents({ name: 'ModalSelect' }).some(s => s.props('label') === 'Parent Page')).toBe(false)
      await wrapper.findComponent({ name: 'ModalRadioTabs' }).vm.$emit('update:modelValue', 'page')
      await nextTick()
      expect(wrapper.findAllComponents({ name: 'ModalSelect' }).some(s => s.props('label') === 'Parent Page')).toBe(true)
    })

    test('Parent Page options include a null "None" option and all pages', () => {
      const wrapper = setup({ parentPage: '/_/pages/uuid-2' })
      const selects = wrapper.findAllComponents({ name: 'ModalSelect' })
      const parentSelect = selects.find(s => s.props('label') === 'Parent Page')
      const options = parentSelect?.props('options') as Array<{ label: string, value: string | null }>
      expect(options).toContainEqual({ label: 'None', value: null })
      expect(options).toContainEqual({ label: 'Conference', value: '/_/pages/uuid-2' })
    })
  })

  describe('Dynamic Page field visibility', () => {
    test('always shows "Dynamic Page" select regardless of parent setting', () => {
      const wrapperNoParent = setup({ parentPage: null })
      const wrapperWithParent = setup({ parentPage: '/_/pages/uuid-2' })
      const labelsNoParent = wrapperNoParent.findAllComponents({ name: 'ModalSelect' }).map(s => s.props('label'))
      const labelsWithParent = wrapperWithParent.findAllComponents({ name: 'ModalSelect' }).map(s => s.props('label'))
      expect(labelsNoParent).toContain('Dynamic Page')
      expect(labelsWithParent).toContain('Dynamic Page')
    })
  })

  describe('depth switcher', () => {
    test('shows depth pill buttons when the resource chain has parents in the store', () => {
      const wrapper = setup({}, (iri) => {
        if (iri === '/_/abstract_page_data/uuid-self') return ref({ data: { title: 'Programme Data', parentPage: '/_/pages/uuid-2' } })
        if (iri === '/_/pages/uuid-2') return ref({ data: { reference: 'Conference', parentPage: null } })
        return ref(null)
      })
      const allText = wrapper.text()
      expect(allText).toContain('Programme Data')
      expect(allText).toContain('Conference')
    })

    test('depth pill buttons include the current data page and its parent', () => {
      const wrapper = setup({}, (iri) => {
        if (iri === '/_/abstract_page_data/uuid-self') return ref({ data: { title: 'Programme Data', parentPage: '/_/pages/uuid-2' } })
        if (iri === '/_/pages/uuid-2') return ref({ data: { reference: 'Conference', parentPage: null } })
        return ref(null)
      })
      const allText = wrapper.text()
      expect(allText).toContain('Programme Data')
      expect(allText).toContain('Conference')
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

  describe('parent data type picker', () => {
    test('shows Parent Data Type select when parentType is "data" with type options', async () => {
      const { wrapper } = setupAdvanced({
        localDataOverrides: { parentPageData: '/_/event_data/x' },
        dataTypes: [{ resourceClass: 'App\\Entity\\EventData' }],
        fqcnToEntrypointKey: (t: string) => t === 'App\\Entity\\EventData' ? 'event_data' : t,
      })
      await nextTick()
      const labels = wrapper.findAllComponents({ name: 'ModalSelect' }).map(s => s.props('label'))
      expect(labels).toContain('Parent Data Type')
    })

    test('dataTypeOptions derives a label from the FQCN tail and skips types without a key', async () => {
      const { wrapper } = setupAdvanced({
        localDataOverrides: { parentPageData: '/_/event_data/x' },
        dataTypes: [
          { resourceClass: 'App\\Entity\\EventData' },
          { resourceClass: 'App\\Entity\\SkippedData' },
        ],
        fqcnToEntrypointKey: (t: string) => t === 'App\\Entity\\EventData' ? 'event_data' : null,
      })
      await nextTick()
      const typeSelect = wrapper.findAllComponents({ name: 'ModalSelect' }).find(s => s.props('label') === 'Parent Data Type')
      const options = typeSelect?.props('options') as Array<{ label: string, value: string | null }>
      expect(options).toContainEqual({ label: 'Select type…', value: null })
      expect(options).toContainEqual({ label: 'EventData', value: 'event_data' })
      // SkippedData has no key, so excluded
      expect(options.find(o => o.label === 'SkippedData')).toBeUndefined()
    })

    test('shows Parent Data select with instance options once a data type is selected', async () => {
      const { wrapper } = setupAdvanced({
        localDataOverrides: { parentPageData: '/_/event_data/x' },
        dataTypes: [{ resourceClass: 'App\\Entity\\EventData' }],
        dataInstances: [
          { '@id': '/_/event_data/x', 'title': 'Event One' },
          { '@id': '/_/event_data/y', 'title': '' },
        ],
        fqcnToEntrypointKey: (t: string) => t === 'App\\Entity\\EventData' ? 'event_data' : t,
        getResource: (iri: string) => iri === '/_/event_data/x' ? ref({ data: { '@type': 'App\\Entity\\EventData' } }) : ref(null),
      })
      await nextTick()
      const dataSelect = wrapper.findAllComponents({ name: 'ModalSelect' }).find(s => s.props('label') === 'Parent Data')
      expect(dataSelect).toBeTruthy()
      const options = dataSelect?.props('options') as Array<{ label: string, value: string | null }>
      expect(options).toContainEqual({ label: 'Select…', value: null })
      expect(options).toContainEqual({ label: 'Event One', value: '/_/event_data/x' })
      // empty title falls back to @id
      expect(options).toContainEqual({ label: '/_/event_data/y', value: '/_/event_data/y' })
    })

    test('selecting a data type loads instances for that type', async () => {
      const { wrapper, loadDataInstances } = setupAdvanced({
        dataTypes: [{ resourceClass: 'App\\Entity\\EventData' }],
        fqcnToEntrypointKey: (t: string) => t,
      })
      await wrapper.findComponent({ name: 'ModalRadioTabs' }).vm.$emit('update:modelValue', 'data')
      await nextTick()
      const typeSelect = wrapper.findAllComponents({ name: 'ModalSelect' }).find(s => s.props('label') === 'Parent Data Type')
      await typeSelect?.vm.$emit('update:modelValue', 'event_data')
      await nextTick()
      expect(loadDataInstances).toHaveBeenCalledWith('event_data')
    })

    test('changing data type clears the previously selected parentPageData', async () => {
      const { wrapper, localResourceData } = setupAdvanced({
        localDataOverrides: { parentPageData: '/_/event_data/x' },
        dataTypes: [{ resourceClass: 'App\\Entity\\EventData' }],
        fqcnToEntrypointKey: (t: string) => t,
        getResource: (iri: string) => iri === '/_/event_data/x' ? ref({ data: { '@type': 'App\\Entity\\EventData' } }) : ref(null),
      })
      await nextTick()
      const typeSelect = wrapper.findAllComponents({ name: 'ModalSelect' }).find(s => s.props('label') === 'Parent Data Type')
      // changing from a non-null value (set by init watcher) to a new value triggers clear
      await typeSelect?.vm.$emit('update:modelValue', 'other_data')
      await nextTick()
      expect(localResourceData.value.parentPageData).toBeNull()
    })

    test('restores selectedParentDataType on first load from the parentPageData resource type', async () => {
      const { wrapper } = setupAdvanced({
        localDataOverrides: { parentPageData: '/_/event_data/x' },
        dataTypes: [{ resourceClass: 'App\\Entity\\EventData' }],
        fqcnToEntrypointKey: (t: string) => t === 'App\\Entity\\EventData' ? 'event_data' : t,
        getResource: (iri: string) => iri === '/_/event_data/x' ? ref({ data: { '@type': 'App\\Entity\\EventData' } }) : ref(null),
      })
      await nextTick()
      // because selectedParentDataType was restored, the Parent Data select should be visible
      const labels = wrapper.findAllComponents({ name: 'ModalSelect' }).map(s => s.props('label'))
      expect(labels).toContain('Parent Data')
    })
  })

  describe('saveResource wrapper', () => {
    test('clears parentPage and parentPageData when parentType is none, then delegates', async () => {
      const { wrapper, handlers, localResourceData } = setupAdvanced({
        localDataOverrides: { parentPage: '/_/pages/uuid-2', parentPageData: '/_/event_data/x' },
      })
      await nextTick()
      // parentType watcher will set parentType to 'page' (parentPage truthy). Set to none.
      await wrapper.findComponent({ name: 'ModalRadioTabs' }).vm.$emit('update:modelValue', null)
      await nextTick()
      // trigger Save & Close button (saveResource(true))
      const buttons = wrapper.findAllComponents({ name: 'CwaUiFormButton' })
      await buttons[0].vm.$emit('click')
      expect(localResourceData.value.parentPage).toBeNull()
      expect(localResourceData.value.parentPageData).toBeNull()
      expect(handlers.saveResource).toHaveBeenCalledWith(true)
    })

    test('keeps parentPage but clears parentPageData when parentType is page', async () => {
      const { wrapper, handlers, localResourceData } = setupAdvanced({
        localDataOverrides: { parentPage: '/_/pages/uuid-2', parentPageData: null },
      })
      await nextTick()
      // parentType is 'page' from init watcher
      const buttons = wrapper.findAllComponents({ name: 'CwaUiFormButton' })
      // second button = Save (saveResource(false))
      await buttons[1].vm.$emit('click')
      expect(localResourceData.value.parentPage).toBe('/_/pages/uuid-2')
      expect(localResourceData.value.parentPageData).toBeNull()
      expect(handlers.saveResource).toHaveBeenCalledWith(false)
    })
  })

  describe('saveTitle wrapper', () => {
    test('does not save when adding', async () => {
      const { wrapper, handlers } = setupAdvanced({
        itemPageOverrides: { isAdding: ref(true) },
      })
      await wrapper.findComponent({ name: 'ResourceModal' }).vm.$emit('save')
      expect(handlers.saveResource).not.toHaveBeenCalled()
    })

    test('saves when not adding', async () => {
      const { wrapper, handlers } = setupAdvanced()
      await wrapper.findComponent({ name: 'ResourceModal' }).vm.$emit('save')
      expect(handlers.saveResource).toHaveBeenCalled()
    })
  })

  describe('view link icon', () => {
    test('renders a CwaLink to the internal resource when not adding and not hidden', () => {
      const { wrapper, handlers } = setupAdvanced()
      expect(wrapper.findComponent({ name: 'CwaLink' }).exists()).toBe(true)
      expect(handlers.getInternalResourceLink).toHaveBeenCalledWith('/_/abstract_page_data/uuid-self')
    })

    test('hides the CwaLink when hideViewLink is true', () => {
      const { wrapper } = setupAdvanced({ props: { hideViewLink: true } })
      expect(wrapper.findComponent({ name: 'CwaLink' }).exists()).toBe(false)
    })
  })

  describe('delete', () => {
    test('handleDeleteClick calls deleteResource and navigates to the data list on success', async () => {
      const { wrapper, handlers } = setupAdvanced()
      // Delete button is in the info tab — find the last CwaUiFormButton
      const buttons = wrapper.findAllComponents({ name: 'CwaUiFormButton' })
      await buttons[buttons.length - 1].vm.$emit('click')
      expect(handlers.deleteResource).toHaveBeenCalled()
      // invoke the success callback passed as 2nd arg
      const successCb = handlers.deleteResource.mock.calls[0][1]
      await successCb()
      expect(mockNavigateTo).toHaveBeenCalledWith({ name: '_cwa-data' })
    })

    test('handleDeleteClick navigates to the typed data list when pageData type is known', async () => {
      const { wrapper, handlers } = setupAdvanced({
        pageData: ref({ data: { '@type': 'App\\Entity\\EventData' } }),
        fqcnToEntrypointKey: (t: string) => t === 'App\\Entity\\EventData' ? 'event_data' : t,
      })
      const buttons = wrapper.findAllComponents({ name: 'CwaUiFormButton' })
      await buttons[buttons.length - 1].vm.$emit('click')
      const successCb = handlers.deleteResource.mock.calls[0][1]
      await successCb()
      expect(mockNavigateTo).toHaveBeenCalledWith({ name: '_cwa-data-type', params: { type: 'event_data' } })
    })
  })

  describe('goToTemplate', () => {
    test('does nothing when no page is set', async () => {
      const { wrapper, toggleEdit } = setupAdvanced({ localDataOverrides: { page: null } })
      await nextTick()
      // The "Go to dynamic template" button only renders when page is set, so simulate via no button
      const goButtons = wrapper.findAll('button').filter(b => b.text() === 'Go to dynamic template')
      expect(goButtons.length).toBe(0)
      expect(mockNavigateTo).not.toHaveBeenCalled()
      expect(toggleEdit).not.toHaveBeenCalled()
    })

    test('emits close, navigates to the template with cwa_force and disables edit', async () => {
      const { wrapper, toggleEdit, handlers } = setupAdvanced({
        localDataOverrides: { page: '/_/pages/template-1' },
      })
      await nextTick()
      const goButton = wrapper.findAll('button').find(b => b.text() === 'Go to dynamic template')
      expect(goButton).toBeTruthy()
      await goButton!.trigger('click')
      await nextTick()
      expect(wrapper.emitted('close')).toBeTruthy()
      expect(handlers.getInternalResourceLink).toHaveBeenCalledWith('/_/pages/template-1')
      expect(mockNavigateTo).toHaveBeenCalledWith(expect.objectContaining({ query: { cwa_force: 'true' } }))
      expect(toggleEdit).toHaveBeenCalledWith(false)
    })
  })

  describe('meta fields config', () => {
    test('renders a ModalSelect per configured meta field', () => {
      const { wrapper } = setupAdvanced({
        pageDataConfig: {
          metaFields: [
            { field: 'category', label: 'Category', options: [{ label: 'A', value: 'a' }] },
            { field: 'status', label: 'Status' },
          ],
        },
        localDataOverrides: { category: 'a', status: null },
      })
      const labels = wrapper.findAllComponents({ name: 'ModalSelect' }).map(s => s.props('label'))
      expect(labels).toContain('Category')
      expect(labels).toContain('Status')
    })
  })

  describe('tabs', () => {
    test('only Details tab when adding', () => {
      const { wrapper } = setupAdvanced({ itemPageOverrides: { isAdding: ref(true) } })
      const tabsHost = wrapper.findComponent({ name: 'ResourceModalTabs' })
      const tabs = tabsHost.props('tabs') as Array<{ id: string }>
      expect(tabs.map(t => t.id)).toEqual(['details'])
    })

    test('Details, Routes and Info tabs when not adding', () => {
      const { wrapper } = setupAdvanced()
      const tabsHost = wrapper.findComponent({ name: 'ResourceModalTabs' })
      const tabs = tabsHost.props('tabs') as Array<{ id: string }>
      expect(tabs.map(t => t.id)).toEqual(['details', 'routes', 'info'])
    })
  })

  describe('pageOptions / Dynamic Page select', () => {
    test('Dynamic Page options are built from dynamicPages', () => {
      const { wrapper } = setupAdvanced({
        dynamicPages: [{ '@id': '/_/pages/p1', 'reference': 'Page One' }],
      })
      const dynamicSelect = wrapper.findAllComponents({ name: 'ModalSelect' }).find(s => s.props('label') === 'Dynamic Page')
      const options = dynamicSelect?.props('options') as Array<{ label: string, value: string }>
      expect(options).toContainEqual({ label: 'Page One', value: '/_/pages/p1' })
    })
  })

  describe('isTemplate watcher', () => {
    test('saves when isTemplate toggles and not adding', async () => {
      const { handlers, localResourceData } = setupAdvanced({
        localDataOverrides: { isTemplate: false },
      })
      await nextTick()
      handlers.saveResource.mockClear()
      localResourceData.value.isTemplate = true
      await nextTick()
      expect(handlers.saveResource).toHaveBeenCalledWith(false)
    })

    test('does not save when isTemplate goes from undefined to defined (initial set)', async () => {
      const { handlers, localResourceData } = setupAdvanced()
      await nextTick()
      handlers.saveResource.mockClear()
      // isTemplate was undefined; set to true (oldIsTemplate undefined -> no save)
      localResourceData.value.isTemplate = true
      await nextTick()
      expect(handlers.saveResource).not.toHaveBeenCalled()
    })
  })

  describe('onMounted', () => {
    test('emits close when no dynamic pages are available', async () => {
      const { wrapper } = setupAdvanced({ dynamicPages: [] })
      await nextTick()
      await nextTick()
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    test('defaults the page to the first option when adding with no page set', async () => {
      const { localResourceData } = setupAdvanced({
        itemPageOverrides: { isAdding: ref(true) },
        localDataOverrides: { page: null },
        dynamicPages: [{ '@id': '/_/pages/first', 'reference': 'First' }],
      })
      await nextTick()
      await nextTick()
      expect(localResourceData.value.page).toBe('/_/pages/first')
    })
  })
})
