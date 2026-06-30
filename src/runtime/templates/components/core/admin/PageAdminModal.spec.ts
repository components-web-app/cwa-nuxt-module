// @vitest-environment nuxt
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { nextTick, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import PageAdminModal from './PageAdminModal.vue'
import * as cwaComposable from '#cwa/composables/cwa'

const { mockUseItemPage, mockUseParentPageLoader, mockUseParentPageDataLoader } = vi.hoisted(() => ({
  mockUseItemPage: vi.fn(),
  mockUseParentPageLoader: vi.fn(),
  mockUseParentPageDataLoader: vi.fn(),
}))

vi.mock('#cwa-layer/pages/_cwa/index/composables/useItemPage', () => ({
  useItemPage: mockUseItemPage,
}))
vi.mock('#cwa-layer/pages/_cwa/index/composables/useParentPageLoader', () => ({
  useParentPageLoader: mockUseParentPageLoader,
}))
vi.mock('#cwa-layer/pages/_cwa/index/composables/useParentPageDataLoader', () => ({
  useParentPageDataLoader: mockUseParentPageDataLoader,
}))

const mockLayouts = [{ '@id': '/_/layouts/default', 'reference': 'Default' }]
const mockParentPages = [
  { '@id': '/_/pages/uuid-1', 'reference': 'Home' },
  { '@id': '/_/pages/uuid-2', 'reference': 'Conference' },
]

function setup(
  localDataOverrides: Record<string, any> = {},
  getResource: (iri: string) => any = () => ref(null),
  parentPagesOverride?: any[],
) {
  const localResourceData = ref({
    '@id': '/_/pages/uuid-self',
    'reference': 'My Page',
    'isTemplate': false,
    'title': '',
    'metaDescription': '',
    'layout': '/_/layouts/default',
    'uiComponent': 'PrimaryPageTemplate',
    'uiClassNames': null,
    'parentPage': null,
    'parentPageData': null,
    ...localDataOverrides,
  })

  mockUseItemPage.mockReturnValue({
    isAdding: ref(false),
    isLoading: ref(false),
    isUpdating: ref(false),
    localResourceData,
    resource: ref({ '@id': '/_/pages/uuid-self', '@type': 'Page', 'route': '/_/routes/uuid' }),
    formatDate: vi.fn(() => '2026-01-01'),
    deleteResource: vi.fn(),
    saveResource: vi.fn(),
    saveTitle: vi.fn(),
    loadResource: vi.fn(),
    getInternalResourceLink: vi.fn(() => ({ name: '_cwa-index-pages-iri', params: {} })),
  })

  mockUseParentPageLoader.mockReturnValue({
    parentPages: ref(parentPagesOverride ?? mockParentPages),
    loadParentPageOptions: vi.fn(),
  })

  mockUseParentPageDataLoader.mockReturnValue({
    dataTypes: ref([]),
    dataInstances: ref([]),
    loadDataTypes: vi.fn(),
    loadDataInstances: vi.fn(),
    fqcnToEntrypointKey: vi.fn((fqcn: string) => {
      const cls = fqcn.split('\\').pop()
      return cls ? cls.charAt(0).toLowerCase() + cls.slice(1) : undefined
    }),
  })

  // @ts-expect-error
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    pagesConfig: { PrimaryPageTemplate: { name: 'Primary Page Template' } },
    fetch: vi.fn().mockReturnValue({
      response: Promise.resolve({ _data: { member: mockLayouts } }),
    }),
    getApiDocumentation: vi.fn().mockResolvedValue({}),
    resources: { getResource: vi.fn(getResource) },
  }))

  return mount(PageAdminModal, {
    props: { iri: '/_/pages/uuid-self' },
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

describe('PageAdminModal', () => {
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

    test('Parent Page options exclude the current page IRI', () => {
      const wrapper = setup({ parentPage: '/_/pages/uuid-2' })
      const selects = wrapper.findAllComponents({ name: 'ModalSelect' })
      const parentSelect = selects.find(s => s.props('label') === 'Parent Page')
      const options = parentSelect?.props('options') as Array<{ value: string }>
      expect(options.map(o => o.value)).not.toContain('/_/pages/uuid-self')
    })

    test('Parent Page options include a null "None" option and all other pages', () => {
      const wrapper = setup({ parentPage: '/_/pages/uuid-2' })
      const selects = wrapper.findAllComponents({ name: 'ModalSelect' })
      const parentSelect = selects.find(s => s.props('label') === 'Parent Page')
      const options = parentSelect?.props('options') as Array<{ label: string, value: string | null }>
      expect(options).toContainEqual({ label: 'None', value: null })
      expect(options).toContainEqual({ label: 'Conference', value: '/_/pages/uuid-2' })
    })

    test('excludes direct descendants from Parent Page options', () => {
      const wrapper = setup({ parentPage: '/_/pages/uuid-1' }, () => ref(null), [
        { '@id': '/_/pages/uuid-1', 'reference': 'Home', 'parentPage': null },
        { '@id': '/_/pages/uuid-child', 'reference': 'Child', 'parentPage': '/_/pages/uuid-self' },
      ])
      const options = wrapper.findAllComponents({ name: 'ModalSelect' })
        .find(s => s.props('label') === 'Parent Page')
        ?.props('options') as Array<{ value: string | null }>
      expect(options.map(o => o.value)).not.toContain('/_/pages/uuid-child')
      expect(options.map(o => o.value)).toContain('/_/pages/uuid-1')
    })

    test('excludes indirect descendants (grandchildren) from Parent Page options', () => {
      const wrapper = setup({ parentPage: '/_/pages/uuid-1' }, () => ref(null), [
        { '@id': '/_/pages/uuid-1', 'reference': 'Home', 'parentPage': null },
        { '@id': '/_/pages/uuid-child', 'reference': 'Child', 'parentPage': '/_/pages/uuid-self' },
        { '@id': '/_/pages/uuid-grandchild', 'reference': 'Grandchild', 'parentPage': '/_/pages/uuid-child' },
      ])
      const options = wrapper.findAllComponents({ name: 'ModalSelect' })
        .find(s => s.props('label') === 'Parent Page')
        ?.props('options') as Array<{ value: string | null }>
      expect(options.map(o => o.value)).not.toContain('/_/pages/uuid-child')
      expect(options.map(o => o.value)).not.toContain('/_/pages/uuid-grandchild')
    })
  })

  describe('Page UI visibility', () => {
    test('always shows Page UI select regardless of parent setting', () => {
      const wrapperNoParent = setup({ parentPage: null })
      const wrapperWithParent = setup({ parentPage: '/_/pages/uuid-2' })
      const labelsNoParent = wrapperNoParent.findAllComponents({ name: 'ModalSelect' }).map(s => s.props('label'))
      const labelsWithParent = wrapperWithParent.findAllComponents({ name: 'ModalSelect' }).map(s => s.props('label'))
      expect(labelsNoParent).toContain('Page UI')
      expect(labelsWithParent).toContain('Page UI')
    })
  })

  describe('depth switcher', () => {
    test('shows depth pill buttons when the resource chain has parents in the store', () => {
      const wrapper = setup({}, (iri) => {
        if (iri === '/_/pages/uuid-self') return ref({ data: { reference: 'Programme', parentPage: '/_/pages/uuid-2' } })
        if (iri === '/_/pages/uuid-2') return ref({ data: { reference: 'Conference', parentPage: null } })
        return ref(null)
      })
      const buttons = wrapper.findAll('button[type="button"]').filter(b => ['Programme', 'Conference'].includes(b.text().trim()))
      expect(buttons.length).toBe(2)
    })

    test('depth pill buttons include the current page and its parent', () => {
      const wrapper = setup({}, (iri) => {
        if (iri === '/_/pages/uuid-self') return ref({ data: { reference: 'Programme', parentPage: '/_/pages/uuid-2' } })
        if (iri === '/_/pages/uuid-2') return ref({ data: { reference: 'Conference', parentPage: null } })
        return ref(null)
      })
      const allText = wrapper.text()
      expect(allText).toContain('Programme')
      expect(allText).toContain('Conference')
    })

    test('does not show depth switcher when the resource has no parents', () => {
      const wrapper = setup({}, (iri) => {
        if (iri === '/_/pages/uuid-self') return ref({ data: { reference: 'My Page', parentPage: null } })
        return ref(null)
      })
      const selects = wrapper.findAllComponents({ name: 'ModalSelect' })
      expect(selects.some(s => s.props('label') === 'Viewing')).toBe(false)
    })

    test('clicking a depth pill button switches displayIri', async () => {
      const wrapper = setup({}, (iri) => {
        if (iri === '/_/pages/uuid-self') return ref({ data: { reference: 'Programme', parentPage: '/_/pages/uuid-2' } })
        if (iri === '/_/pages/uuid-2') return ref({ data: { reference: 'Conference', parentPage: null } })
        return ref(null)
      })
      const conferenceBtn = wrapper.findAll('button[type="button"]').find(b => b.text().trim() === 'Conference')
      expect(conferenceBtn).toBeTruthy()
      await conferenceBtn!.trigger('click')
      // the active class should now be applied to the Conference button
      expect(conferenceBtn!.classes()).toContain('cwa:bg-stone-700/80')
    })

    test('depth pill falls back to title then iri when reference missing', () => {
      const wrapper = setup({}, (iri) => {
        if (iri === '/_/pages/uuid-self') return ref({ data: { title: 'Titled Page', parentPage: '/_/pages/uuid-2' } })
        if (iri === '/_/pages/uuid-2') return ref({ data: { parentPage: null } })
        return ref(null)
      })
      const text = wrapper.text()
      expect(text).toContain('Titled Page')
      // parent has neither reference nor title, falls back to the iri
      expect(text).toContain('/_/pages/uuid-2')
    })
  })
})

// Richer helper that returns the wrapper together with the reactive refs/mocks
// so we can drive watchers, save/delete handlers, and onMounted side-effects.
function setupRich(opts: {
  localDataOverrides?: Record<string, any>
  getResource?: (iri: string) => any
  isAdding?: boolean
  dataTypes?: any[]
  dataInstances?: any[]
  pagesConfig?: Record<string, any>
  layoutsMember?: any[]
  fetchImpl?: any
} = {}) {
  const localResourceData = ref<any>({
    '@id': '/_/pages/uuid-self',
    'reference': 'My Page',
    'isTemplate': false,
    'title': '',
    'metaDescription': '',
    'createdAt': '2026-01-01',
    'updatedAt': '2026-01-02',
    'layout': '/_/layouts/default',
    'uiComponent': 'PrimaryPageTemplate',
    'uiClassNames': null,
    'parentPage': null,
    'parentPageData': null,
    ...opts.localDataOverrides,
  })

  const isAddingRef = ref(opts.isAdding ?? false)
  const isLoadingRef = ref(false)
  const saveResource = vi.fn()
  const saveTitle = vi.fn()
  const deleteResource = vi.fn()
  const loadDataInstances = vi.fn()

  mockUseItemPage.mockReturnValue({
    isAdding: isAddingRef,
    isLoading: isLoadingRef,
    isUpdating: ref(false),
    localResourceData,
    resource: ref({ '@id': '/_/pages/uuid-self', '@type': 'Page', 'route': '/_/routes/uuid' }),
    formatDate: vi.fn(() => '2026-01-01'),
    deleteResource,
    saveResource,
    saveTitle,
    loadResource: vi.fn(),
    getInternalResourceLink: vi.fn(() => ({ name: '_cwa-index-pages-iri', params: {} })),
  })

  mockUseParentPageLoader.mockReturnValue({
    parentPages: ref(mockParentPages),
    loadParentPageOptions: vi.fn(),
  })

  mockUseParentPageDataLoader.mockReturnValue({
    dataTypes: ref(opts.dataTypes ?? []),
    dataInstances: ref(opts.dataInstances ?? []),
    loadDataTypes: vi.fn(),
    loadDataInstances,
    fqcnToEntrypointKey: vi.fn((fqcn: string) => {
      const cls = fqcn.split('\\').pop()
      return cls ? cls.charAt(0).toLowerCase() + cls.slice(1) : undefined
    }),
  })

  const fetch = opts.fetchImpl ?? vi.fn().mockReturnValue({
    response: Promise.resolve({ _data: { member: opts.layoutsMember ?? mockLayouts } }),
  })

  // @ts-expect-error
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    pagesConfig: opts.pagesConfig ?? { PrimaryPageTemplate: { name: 'Primary Page Template' } },
    fetch,
    getApiDocumentation: vi.fn().mockResolvedValue({}),
    resources: { getResource: vi.fn(opts.getResource ?? (() => ref(null))) },
  }))

  const wrapper = mount(PageAdminModal, {
    props: { iri: '/_/pages/uuid-self' },
    shallow: true,
    global: {
      stubs: {
        ResourceModalTabs: {
          props: ['tabs'],
          template: '<div><slot name="details" /><slot name="routes" /><slot name="info" /></div>',
        },
        ResourceModal: {
          name: 'ResourceModal',
          emits: ['close', 'save'],
          template: '<div><slot name="subheader" /><slot name="icons" /><slot /><slot name="title" /></div>',
        },
      },
    },
  })

  return { wrapper, localResourceData, isAddingRef, isLoadingRef, saveResource, saveTitle, deleteResource, loadDataInstances, fetch }
}

describe('PageAdminModal additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('saveResource button handlers', () => {
    test('"Save & Close" button clears non-page parent fields and calls saveResource(true)', async () => {
      const { wrapper, localResourceData, saveResource } = setupRich({
        localDataOverrides: { parentPage: null, parentPageData: '/page_data/foo' },
      })
      // parentType derived from parentPageData -> 'data', so parentPage should be cleared, parentPageData kept
      const buttons = wrapper.findAllComponents({ name: 'CwaUiFormButton' })
      const saveClose = buttons.find(b => b.text().includes('& Close'))
      expect(saveClose).toBeTruthy()
      await saveClose!.trigger('click')
      expect(saveResource).toHaveBeenCalledWith(true)
      expect(localResourceData.value.parentPage).toBeNull()
    })

    test('"Save" button calls saveResource(false) and clears parentPageData when type is page', async () => {
      const { wrapper, localResourceData, saveResource } = setupRich({
        localDataOverrides: { parentPage: '/_/pages/uuid-2', parentPageData: '/page_data/foo' },
      })
      const buttons = wrapper.findAllComponents({ name: 'CwaUiFormButton' })
      const saveBtn = buttons.find(b => b.text().trim() === 'Save' && !b.text().includes('Close'))
      expect(saveBtn).toBeTruthy()
      await saveBtn!.trigger('click')
      expect(saveResource).toHaveBeenCalledWith(false)
      // parentType is 'page', so parentPageData cleared, parentPage kept
      expect(localResourceData.value.parentPageData).toBeNull()
      expect(localResourceData.value.parentPage).toBe('/_/pages/uuid-2')
    })

    test('when type is none both parent fields are cleared on save', async () => {
      const { wrapper, localResourceData, saveResource } = setupRich({
        localDataOverrides: { parentPage: null, parentPageData: null },
      })
      const buttons = wrapper.findAllComponents({ name: 'CwaUiFormButton' })
      const saveBtn = buttons.find(b => b.text().trim() === 'Save' && !b.text().includes('Close'))
      await saveBtn!.trigger('click')
      expect(saveResource).toHaveBeenCalledWith(false)
      expect(localResourceData.value.parentPage).toBeNull()
      expect(localResourceData.value.parentPageData).toBeNull()
    })

    test('add buttons read "Add & Close" and "Add Now" when isAdding', () => {
      const { wrapper } = setupRich({ isAdding: true })
      const buttons = wrapper.findAllComponents({ name: 'CwaUiFormButton' })
      const labels = buttons.map(b => b.text().trim())
      expect(labels).toContain('Add & Close')
      expect(labels).toContain('Add Now')
    })
  })

  describe('saveTitle (ResourceModal @save)', () => {
    test('does nothing when isAdding', async () => {
      const { wrapper, saveResource } = setupRich({ isAdding: true })
      await wrapper.findComponent({ name: 'ResourceModal' }).vm.$emit('save')
      expect(saveResource).not.toHaveBeenCalled()
    })

    test('calls saveResource when not adding', async () => {
      const { wrapper, saveResource } = setupRich({ isAdding: false })
      saveResource.mockClear()
      await wrapper.findComponent({ name: 'ResourceModal' }).vm.$emit('save')
      // local saveResource() -> _saveResource(close) with default close=false
      expect(saveResource).toHaveBeenCalledWith(false)
    })
  })

  describe('delete handler', () => {
    test('Delete button calls deleteResource', async () => {
      const { wrapper, deleteResource } = setupRich()
      const buttons = wrapper.findAllComponents({ name: 'CwaUiFormButton' })
      const deleteBtn = buttons.find(b => b.text().trim() === 'Delete')
      expect(deleteBtn).toBeTruthy()
      await deleteBtn!.trigger('click')
      expect(deleteResource).toHaveBeenCalled()
    })
  })

  describe('data parent type options', () => {
    test('dataTypeOptions are derived from dataTypes', async () => {
      const { wrapper } = setupRich({
        localDataOverrides: { parentPageData: null, parentPage: null },
        dataTypes: [{ resourceClass: 'App\\Entity\\BlogPost' }],
      })
      // Switch the parent radio to "data" to reveal the type select
      await wrapper.findComponent({ name: 'ModalRadioTabs' }).vm.$emit('update:modelValue', 'data')
      await nextTick()
      const typeSelect = wrapper.findAllComponents({ name: 'ModalSelect' }).find(s => s.props('label') === 'Parent Data Type')
      expect(typeSelect).toBeTruthy()
      const options = typeSelect!.props('options') as Array<{ label: string, value: string | null }>
      expect(options).toContainEqual({ label: 'Select type…', value: null })
      expect(options).toContainEqual({ label: 'BlogPost', value: 'blogPost' })
    })

    test('selecting a data type loads instances and reveals the instance select', async () => {
      const { wrapper, loadDataInstances } = setupRich({
        localDataOverrides: { parentPageData: null, parentPage: null },
        dataTypes: [{ resourceClass: 'App\\Entity\\BlogPost' }],
        dataInstances: [
          { '@id': '/page_data/a', 'title': 'Alpha' },
          { '@id': '/page_data/b' },
        ],
      })
      await wrapper.findComponent({ name: 'ModalRadioTabs' }).vm.$emit('update:modelValue', 'data')
      await nextTick()
      const typeSelect = wrapper.findAllComponents({ name: 'ModalSelect' }).find(s => s.props('label') === 'Parent Data Type')
      await typeSelect!.vm.$emit('update:modelValue', 'blogPost')
      await nextTick()
      expect(loadDataInstances).toHaveBeenCalledWith('blogPost')
      const instanceSelect = wrapper.findAllComponents({ name: 'ModalSelect' }).find(s => s.props('label') === 'Parent Data')
      expect(instanceSelect).toBeTruthy()
      const options = instanceSelect!.props('options') as Array<{ label: string, value: string | null }>
      expect(options).toContainEqual({ label: 'Select…', value: null })
      expect(options).toContainEqual({ label: 'Alpha', value: '/page_data/a' })
      // instance without title falls back to its @id
      expect(options).toContainEqual({ label: '/page_data/b', value: '/page_data/b' })
    })

    test('changing data type after a selection clears parentPageData', async () => {
      const { wrapper, localResourceData } = setupRich({
        localDataOverrides: { parentPageData: null, parentPage: null },
        dataTypes: [{ resourceClass: 'App\\Entity\\BlogPost' }, { resourceClass: 'App\\Entity\\NewsItem' }],
      })
      await wrapper.findComponent({ name: 'ModalRadioTabs' }).vm.$emit('update:modelValue', 'data')
      await nextTick()
      const typeSelect = wrapper.findAllComponents({ name: 'ModalSelect' }).find(s => s.props('label') === 'Parent Data Type')
      await typeSelect!.vm.$emit('update:modelValue', 'blogPost')
      await nextTick()
      localResourceData.value.parentPageData = '/page_data/a'
      // change again -> oldKey is non-null so parentPageData should be cleared
      await typeSelect!.vm.$emit('update:modelValue', 'newsItem')
      await nextTick()
      expect(localResourceData.value.parentPageData).toBeNull()
    })
  })

  describe('localResourceData watcher restores selectedParentDataType', () => {
    test('on first load with parentPageData, restores the data type from the stored resource @type', async () => {
      const { wrapper } = setupRich({
        localDataOverrides: { parentPage: null, parentPageData: '/page_data/a' },
        dataTypes: [{ resourceClass: 'App\\Entity\\BlogPost' }],
        dataInstances: [{ '@id': '/page_data/a', 'title': 'Alpha' }],
        getResource: (iri: string) => {
          if (iri === '/page_data/a') return ref({ data: { '@type': 'App\\Entity\\BlogPost' } })
          return ref(null)
        },
      })
      await nextTick()
      // parentType should be 'data' and the instance select should be visible & resolved
      const typeSelect = wrapper.findAllComponents({ name: 'ModalSelect' }).find(s => s.props('label') === 'Parent Data Type')
      expect(typeSelect).toBeTruthy()
      const instanceSelect = wrapper.findAllComponents({ name: 'ModalSelect' }).find(s => s.props('label') === 'Parent Data')
      expect(instanceSelect).toBeTruthy()
    })
  })

  describe('pageStyleOptions', () => {
    test('renders Style select with configured classes plus a Default option', () => {
      const { wrapper } = setupRich({
        pagesConfig: {
          PrimaryPageTemplate: {
            name: 'Primary',
            classes: { Wide: 'cwa:max-w-full', Narrow: 'cwa:max-w-prose' },
          },
        },
      })
      const styleSelect = wrapper.findAllComponents({ name: 'ModalSelect' }).find(s => s.props('label') === 'Style')
      expect(styleSelect).toBeTruthy()
      const options = styleSelect!.props('options') as Array<{ label: string, value: string | null }>
      expect(options).toContainEqual({ label: 'Default', value: null })
      expect(options).toContainEqual({ label: 'Wide', value: 'cwa:max-w-full' })
      expect(options).toContainEqual({ label: 'Narrow', value: 'cwa:max-w-prose' })
    })

    test('hides Style select when no classes configured', () => {
      const { wrapper } = setupRich({
        pagesConfig: { PrimaryPageTemplate: { name: 'Primary' } },
      })
      const styleSelect = wrapper.findAllComponents({ name: 'ModalSelect' }).find(s => s.props('label') === 'Style')
      expect(styleSelect).toBeFalsy()
    })
  })

  describe('isTemplate watcher', () => {
    test('changing isTemplate when not adding triggers a save', async () => {
      const { localResourceData, saveResource } = setupRich({ isAdding: false })
      saveResource.mockClear()
      localResourceData.value.isTemplate = true
      await nextTick()
      expect(saveResource).toHaveBeenCalledWith(false)
    })

    test('changing isTemplate when adding does not save', async () => {
      const { localResourceData, saveResource } = setupRich({ isAdding: true })
      saveResource.mockClear()
      localResourceData.value.isTemplate = true
      await nextTick()
      expect(saveResource).not.toHaveBeenCalled()
    })
  })

  describe('loadLayoutOptions (onMounted)', () => {
    test('emits close when no layouts are returned', async () => {
      const { wrapper } = setupRich({ layoutsMember: [] })
      await flushPromises()
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    test('sets default layout when adding and none set', async () => {
      const { wrapper, localResourceData } = setupRich({
        isAdding: true,
        localDataOverrides: { layout: null },
        layoutsMember: [{ '@id': '/_/layouts/default', 'reference': 'Default' }],
      })
      await flushPromises()
      expect(localResourceData.value.layout).toBe('/_/layouts/default')
      // sanity: no close emitted since layouts exist
      expect(wrapper.emitted('close')).toBeFalsy()
    })
  })

  describe('view link', () => {
    test('renders the eye/view link when not hidden and not adding', () => {
      const { wrapper } = setupRich({ isAdding: false })
      // The view link lives in the #icons slot and contains the eye icon
      const html = wrapper.html()
      expect(html.toLowerCase()).toContain('eyeicon')
    })
  })
})
