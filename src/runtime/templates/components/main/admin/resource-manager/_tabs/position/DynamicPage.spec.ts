// @vitest-environment happy-dom
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import DynamicPage from './DynamicPage.vue'

// vi.hoisted runs before imports, so we cannot use ref/reactive from vue inside it.
const mockCurrentIriObj = vi.hoisted(() => ({ value: '/_/component_positions/pos-1' as string | undefined }))
const mockResourceStore = vi.hoisted(() => ({ value: {} as Record<string, any> }))

const mockGetResource = vi.hoisted(() => vi.fn((iri: string) => ({ value: mockResourceStore.value[iri] })))
const mockUpdateResource = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockInitAddResource = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockResourceStackRef = vi.hoisted(() => ({ value: ['stack-item'] }))

const mockGetTypeOptions = vi.hoisted(() => vi.fn())
const mockGetPropertyOptions = vi.hoisted(() => vi.fn())

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: () => ({
    admin: {
      resourceStackManager: {
        currentIri: mockCurrentIriObj,
        resourceStack: mockResourceStackRef,
        getState: vi.fn(),
        setState: vi.fn(),
      },
    },
    resources: { getResource: mockGetResource },
    resourcesManager: { updateResource: mockUpdateResource, initAddResource: mockInitAddResource },
  }),
}))

vi.mock('#cwa/templates/components/main/admin/_common/useDynamicPositionSelectOptions', () => ({
  useDynamicPositionSelectOptions: () => ({
    getTypeOptions: mockGetTypeOptions,
    getPropertyOptions: mockGetPropertyOptions,
  }),
}))

const TYPE_OPTIONS = [
  { label: 'Event Data', value: 'App\\Entity\\EventData' },
  { label: 'Blog', value: 'App\\Entity\\Blog' },
]
const PROPERTY_OPTIONS = [
  { label: 'Hero Image', value: 'heroImage' },
  { label: 'Ticket Link', value: 'ticketLink' },
]

// Minimal ModalSelect stub that surfaces the props we assert against and re-emits.
const ModalSelectStub = {
  name: 'ModalSelect',
  props: ['modelValue', 'label', 'options'],
  emits: ['update:modelValue'],
  template: '<div class="modal-select" />',
}

const FormButtonStub = {
  name: 'CwaUiFormButton',
  props: ['color'],
  emits: ['click'],
  template: '<button @click="$emit(\'click\')"><slot /></button>',
}

function setPositionResource(data: Record<string, any> = {}) {
  mockResourceStore.value[mockCurrentIriObj.value as string] = { data }
}

function mountComponent() {
  return mount(DynamicPage, {
    global: {
      stubs: {
        ModalSelect: ModalSelectStub,
        CwaUiFormButton: FormButtonStub,
      },
    },
  })
}

describe('DynamicPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCurrentIriObj.value = '/_/component_positions/pos-1'
    mockResourceStore.value = {}
    mockResourceStackRef.value = ['stack-item']
    mockGetTypeOptions.mockResolvedValue(TYPE_OPTIONS)
    mockGetPropertyOptions.mockResolvedValue(PROPERTY_OPTIONS)
  })

  describe('onMounted', () => {
    test('loads type options on mount', async () => {
      setPositionResource({})
      const wrapper = mountComponent()
      await flushPromises()
      expect(mockGetTypeOptions).toHaveBeenCalled()
      const typeSelect = wrapper.findAllComponents(ModalSelectStub).find(s => s.props('label') === 'Data type')
      expect(typeSelect).toBeTruthy()
      expect(typeSelect!.props('options')).toEqual(TYPE_OPTIONS)
    })

    test('seeds selected type/property from stored resource data and loads property options', async () => {
      setPositionResource({ pageDataClass: 'App\\Entity\\EventData', pageDataProperty: 'heroImage' })
      const wrapper = mountComponent()
      await flushPromises()
      expect(mockGetPropertyOptions).toHaveBeenCalledWith('App\\Entity\\EventData', null)
      const typeSelect = wrapper.findAllComponents(ModalSelectStub).find(s => s.props('label') === 'Data type')
      expect(typeSelect!.props('modelValue')).toBe('App\\Entity\\EventData')
      const fieldSelect = wrapper.findAllComponents(ModalSelectStub).find(s => s.props('label') === 'Field')
      expect(fieldSelect).toBeTruthy()
      expect(fieldSelect!.props('modelValue')).toBe('heroImage')
    })

    test('does not render Field select when no type stored', async () => {
      setPositionResource({})
      const wrapper = mountComponent()
      await flushPromises()
      const fieldSelect = wrapper.findAllComponents(ModalSelectStub).find(s => s.props('label') === 'Field')
      expect(fieldSelect).toBeFalsy()
    })
  })

  describe('allowedComponents', () => {
    test('passes allowedComponents from component group to getPropertyOptions', async () => {
      mockResourceStore.value['/_/component_groups/cg-1'] = {
        data: { allowedComponents: ['/_api/component/images'] },
      }
      setPositionResource({
        pageDataClass: 'App\\Entity\\EventData',
        pageDataProperty: 'heroImage',
        componentGroup: '/_/component_groups/cg-1',
      })
      mountComponent()
      await flushPromises()
      expect(mockGetPropertyOptions).toHaveBeenCalledWith('App\\Entity\\EventData', ['/_api/component/images'])
    })

    test('passes null allowedComponents when component group has none', async () => {
      mockResourceStore.value['/_/component_groups/cg-1'] = { data: {} }
      setPositionResource({
        pageDataClass: 'App\\Entity\\EventData',
        componentGroup: '/_/component_groups/cg-1',
      })
      mountComponent()
      await flushPromises()
      expect(mockGetPropertyOptions).toHaveBeenCalledWith('App\\Entity\\EventData', null)
    })
  })

  describe('onTypeChange', () => {
    test('changing the type resets property, loads new options, and reveals Field select', async () => {
      setPositionResource({})
      const wrapper = mountComponent()
      await flushPromises()
      mockGetPropertyOptions.mockClear()

      const typeSelect = wrapper.findAllComponents(ModalSelectStub).find(s => s.props('label') === 'Data type')
      await typeSelect!.vm.$emit('update:modelValue', 'App\\Entity\\Blog')
      await flushPromises()

      expect(mockGetPropertyOptions).toHaveBeenCalledWith('App\\Entity\\Blog', null)
      const fieldSelect = wrapper.findAllComponents(ModalSelectStub).find(s => s.props('label') === 'Field')
      expect(fieldSelect).toBeTruthy()
      expect(fieldSelect!.props('modelValue')).toBeNull()
    })

    test('clearing the type (null) empties property options and hides Field select', async () => {
      setPositionResource({ pageDataClass: 'App\\Entity\\EventData', pageDataProperty: 'heroImage' })
      const wrapper = mountComponent()
      await flushPromises()

      const typeSelect = wrapper.findAllComponents(ModalSelectStub).find(s => s.props('label') === 'Data type')
      await typeSelect!.vm.$emit('update:modelValue', null)
      await flushPromises()

      const fieldSelect = wrapper.findAllComponents(ModalSelectStub).find(s => s.props('label') === 'Field')
      expect(fieldSelect).toBeFalsy()
    })
  })

  describe('onPropertyChange / save', () => {
    test('selecting a property saves with type and property', async () => {
      setPositionResource({ pageDataClass: 'App\\Entity\\EventData' })
      const wrapper = mountComponent()
      await flushPromises()

      const fieldSelect = wrapper.findAllComponents(ModalSelectStub).find(s => s.props('label') === 'Field')
      await fieldSelect!.vm.$emit('update:modelValue', 'ticketLink')
      await flushPromises()

      expect(mockUpdateResource).toHaveBeenCalledWith({
        endpoint: '/_/component_positions/pos-1',
        data: { pageDataProperty: 'ticketLink', pageDataClass: 'App\\Entity\\EventData' },
      })
    })

    test('clearing the property (null) does not save', async () => {
      setPositionResource({ pageDataClass: 'App\\Entity\\EventData', pageDataProperty: 'heroImage' })
      const wrapper = mountComponent()
      await flushPromises()

      const fieldSelect = wrapper.findAllComponents(ModalSelectStub).find(s => s.props('label') === 'Field')
      await fieldSelect!.vm.$emit('update:modelValue', null)
      await flushPromises()

      expect(mockUpdateResource).not.toHaveBeenCalled()
    })
  })

  describe('isDirtyIncomplete', () => {
    test('shows the cancel prompt when a type is selected but no property', async () => {
      setPositionResource({})
      const wrapper = mountComponent()
      await flushPromises()

      const typeSelect = wrapper.findAllComponents(ModalSelectStub).find(s => s.props('label') === 'Data type')
      await typeSelect!.vm.$emit('update:modelValue', 'App\\Entity\\Blog')
      await flushPromises()

      expect(wrapper.text()).toContain('Select a field to complete the configuration.')
      expect(wrapper.findAllComponents(FormButtonStub).some(b => b.text().trim() === 'Cancel')).toBe(true)
    })

    test('cancel restores stored values and hides the prompt', async () => {
      setPositionResource({ pageDataClass: 'App\\Entity\\EventData', pageDataProperty: 'heroImage' })
      const wrapper = mountComponent()
      await flushPromises()

      // make it dirty/incomplete by clearing the property locally via Field change
      const fieldSelect = wrapper.findAllComponents(ModalSelectStub).find(s => s.props('label') === 'Field')
      await fieldSelect!.vm.$emit('update:modelValue', null)
      await flushPromises()
      expect(wrapper.text()).toContain('Select a field to complete the configuration.')

      const cancelBtn = wrapper.findAllComponents(FormButtonStub).find(b => b.text().trim() === 'Cancel')
      await cancelBtn!.trigger('click')
      await flushPromises()

      expect(wrapper.text()).not.toContain('Select a field to complete the configuration.')
      const fieldSelectAfter = wrapper.findAllComponents(ModalSelectStub).find(s => s.props('label') === 'Field')
      expect(fieldSelectAfter!.props('modelValue')).toBe('heroImage')
    })
  })

  describe('makeStatic', () => {
    test('shows "Make static" when component and pageDataProperty exist', async () => {
      setPositionResource({
        component: '/component/images/1',
        pageDataClass: 'App\\Entity\\EventData',
        pageDataProperty: 'heroImage',
      })
      const wrapper = mountComponent()
      await flushPromises()
      expect(wrapper.findAllComponents(FormButtonStub).some(b => b.text().trim() === 'Make static')).toBe(true)
    })

    test('makeStatic clears the config via updateResource and local state', async () => {
      setPositionResource({
        component: '/component/images/1',
        pageDataClass: 'App\\Entity\\EventData',
        pageDataProperty: 'heroImage',
      })
      const wrapper = mountComponent()
      await flushPromises()

      const makeStaticBtn = wrapper.findAllComponents(FormButtonStub).find(b => b.text().trim() === 'Make static')
      await makeStaticBtn!.trigger('click')
      await flushPromises()

      expect(mockUpdateResource).toHaveBeenCalledWith({
        endpoint: '/_/component_positions/pos-1',
        data: { pageDataProperty: null, pageDataClass: null },
      })
      // local state reset -> type cleared so Field select gone
      await nextTick()
      const fieldSelect = wrapper.findAllComponents(ModalSelectStub).find(s => s.props('label') === 'Field')
      expect(fieldSelect).toBeFalsy()
    })

    test('does not show "Make static" without a component', async () => {
      setPositionResource({ pageDataClass: 'App\\Entity\\EventData', pageDataProperty: 'heroImage' })
      const wrapper = mountComponent()
      await flushPromises()
      expect(wrapper.findAllComponents(FormButtonStub).some(b => b.text().trim() === 'Make static')).toBe(false)
    })
  })

  describe('addFallbackComponent', () => {
    test('shows "Add Fallback Component" when no component set', async () => {
      setPositionResource({})
      const wrapper = mountComponent()
      await flushPromises()
      expect(wrapper.findAllComponents(FormButtonStub).some(b => b.text().trim() === 'Add Fallback Component')).toBe(true)
    })

    test('clicking it calls initAddResource with iri, null and the resource stack', async () => {
      setPositionResource({})
      const wrapper = mountComponent()
      await flushPromises()

      const addBtn = wrapper.findAllComponents(FormButtonStub).find(b => b.text().trim() === 'Add Fallback Component')
      await addBtn!.trigger('click')
      await flushPromises()

      expect(mockInitAddResource).toHaveBeenCalledWith('/_/component_positions/pos-1', null, ['stack-item'])
    })

    test('hides "Add Fallback Component" when a component is set', async () => {
      setPositionResource({ component: '/component/images/1' })
      const wrapper = mountComponent()
      await flushPromises()
      expect(wrapper.findAllComponents(FormButtonStub).some(b => b.text().trim() === 'Add Fallback Component')).toBe(false)
    })
  })

  describe('guards when iri is missing', () => {
    test('save/makeStatic/addFallbackComponent no-op without an iri', async () => {
      mockCurrentIriObj.value = undefined
      const wrapper = mountComponent()
      await flushPromises()

      // No type select stored data; makeStatic/save guarded. Trigger addFallbackComponent.
      const addBtn = wrapper.findAllComponents(FormButtonStub).find(b => b.text().trim() === 'Add Fallback Component')
      if (addBtn) {
        await addBtn.trigger('click')
        await flushPromises()
      }
      expect(mockInitAddResource).not.toHaveBeenCalled()
      expect(mockUpdateResource).not.toHaveBeenCalled()
    })
  })

  test('exposeMeta is exposed on the component', async () => {
    setPositionResource({})
    const wrapper = mountComponent()
    await flushPromises()
    expect((wrapper.vm as any).name).toBe('Dynamic Component')
  })
})
