// @vitest-environment nuxt
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import LayoutItemPage from './[iri].vue'
import { componentNames } from '#components'
import * as cwaComposable from '#cwa/composables/cwa'

const { mockUseItemPage } = vi.hoisted(() => ({
  mockUseItemPage: vi.fn(),
}))

vi.mock('../composables/useItemPage', () => ({
  useItemPage: mockUseItemPage,
}))

// `#components` is a nuxt virtual module and cannot be vi.mock'ed (its id does not resolve outside
// the nuxt vite plugins), so the resolvable set is the playground's real registered layouts.
const resolvableLayoutNames = componentNames.filter((n: string) => n.startsWith('CwaLayout'))
const resolvableLayoutName = resolvableLayoutNames[0]
const otherResolvableLayoutName = resolvableLayoutNames[1]
const unresolvableLayoutName = 'CwaLayoutRenamedAway'

// keyed by the "clean" name (the CwaLayout prefix stripped)
const layoutsConfig = { [resolvableLayoutName.replace(/^CwaLayout/, '')]: { name: 'Configured Name' } }

function expectedResolvableOptions() {
  return resolvableLayoutNames.map((name: string) => {
    const cleanName = name.replace(/^CwaLayout/, '')
    return { label: layoutsConfig[cleanName]?.name || cleanName, value: name }
  })
}

function setup(opts: { uiComponent?: string | null } = {}) {
  const localResourceData = ref<any>({
    '@id': '/_/layouts/uuid-self',
    '@type': 'Layout',
    'reference': 'My Layout',
    'uiComponent': opts.uiComponent === undefined ? resolvableLayoutName : opts.uiComponent,
    'uiClassNames': null,
    'createdAt': '2026-01-01',
    'updatedAt': '2026-01-02',
  })

  const saveResource = vi.fn()
  const deleteResource = vi.fn()

  mockUseItemPage.mockReturnValue({
    isAdding: ref(false),
    isLoading: ref(false),
    isUpdating: ref(false),
    localResourceData,
    formatDate: vi.fn(() => '2026-01-01'),
    deleteResource,
    saveResource,
    saveTitle: vi.fn(),
  })

  // @ts-expect-error partial mock
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    layoutsConfig,
  }))

  const wrapper = mount(LayoutItemPage, {
    shallow: true,
    global: {
      stubs: {
        ResourceModalTabs: {
          props: ['tabs'],
          template: '<div><slot name="details" /><slot name="info" /></div>',
        },
        ResourceModal: {
          name: 'ResourceModal',
          emits: ['close', 'save'],
          template: '<div><slot name="subheader" /><slot name="icons" /><slot /><slot name="title" /></div>',
        },
      },
    },
  })

  return { wrapper, localResourceData, saveResource, deleteResource }
}

type Wrapper = ReturnType<typeof setup>['wrapper']

function layoutUiSelect(wrapper: Wrapper) {
  return wrapper.findAllComponents({ name: 'ModalSelect' }).find(s => s.props('label') === 'Layout UI')
}

function layoutUiOptions(wrapper: Wrapper) {
  return layoutUiSelect(wrapper)?.props('options') as Array<{ label: string, value: string | null }>
}

describe('Layout admin page – Layout UI select', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('the playground registers at least 2 layout components (fixture sanity)', () => {
    expect(resolvableLayoutNames.length).toBeGreaterThanOrEqual(2)
  })

  describe('existing behaviour (must not change)', () => {
    test('lists every registered CwaLayout* component, named from layoutsConfig where configured', () => {
      const { wrapper } = setup()
      expect(layoutUiOptions(wrapper)).toEqual(expectedResolvableOptions())
    })

    test('selecting a resolvable option still updates the resource data', async () => {
      const { wrapper, localResourceData } = setup()
      await layoutUiSelect(wrapper)!.vm.$emit('update:modelValue', otherResolvableLayoutName)
      expect(localResourceData.value.uiComponent).toBe(otherResolvableLayoutName)
    })
  })

  describe('when the stored uiComponent resolves', () => {
    test('adds no extra option', () => {
      const { wrapper } = setup({ uiComponent: otherResolvableLayoutName })
      expect(layoutUiOptions(wrapper)).toEqual(expectedResolvableOptions())
      expect(layoutUiOptions(wrapper).some(o => o.label.includes('not found'))).toBe(false)
    })

    test('shows no warning', () => {
      const { wrapper } = setup({ uiComponent: otherResolvableLayoutName })
      expect(wrapper.findComponent({ name: 'CwaUiAlertWarning' }).exists()).toBe(false)
    })
  })

  describe('when the stored uiComponent is empty', () => {
    test('adds no extra option and shows no warning', () => {
      const { wrapper } = setup({ uiComponent: null })
      expect(layoutUiOptions(wrapper)).toEqual(expectedResolvableOptions())
      expect(wrapper.findComponent({ name: 'CwaUiAlertWarning' }).exists()).toBe(false)
    })
  })

  describe('when the stored uiComponent cannot be resolved', () => {
    test('appends an option for the stored value marked as not found, keeping the resolvable ones', () => {
      const { wrapper } = setup({ uiComponent: unresolvableLayoutName })
      expect(layoutUiOptions(wrapper)).toEqual([
        ...expectedResolvableOptions(),
        { label: 'RenamedAway (component not found)', value: unresolvableLayoutName },
      ])
    })

    test('keeps the raw stored value as the label when it is not a CwaLayout* name', () => {
      const { wrapper } = setup({ uiComponent: 'TotallyMadeUp' })
      expect(layoutUiOptions(wrapper)).toContainEqual({ label: 'TotallyMadeUp (component not found)', value: 'TotallyMadeUp' })
    })

    test('renders a warning naming the unresolvable component and the resource', () => {
      const { wrapper } = setup({ uiComponent: unresolvableLayoutName })
      const warning = wrapper.findComponent({ name: 'CwaUiAlertWarning' })
      expect(warning.exists()).toBe(true)
      expect(warning.text()).toContain(`The component '${unresolvableLayoutName}' for resource '/_/layouts/uuid-self' cannot be resolved`)
    })

    test('does not mutate the stored resource data', () => {
      const { wrapper, localResourceData, saveResource } = setup({ uiComponent: unresolvableLayoutName })
      expect(wrapper.exists()).toBe(true)
      expect(localResourceData.value.uiComponent).toBe(unresolvableLayoutName)
      expect(saveResource).not.toHaveBeenCalled()
    })

    test('choosing a real option from the select replaces the unresolvable value and clears the warning', async () => {
      const { wrapper, localResourceData } = setup({ uiComponent: unresolvableLayoutName })
      await layoutUiSelect(wrapper)!.vm.$emit('update:modelValue', resolvableLayoutName)
      expect(localResourceData.value.uiComponent).toBe(resolvableLayoutName)
      expect(wrapper.findComponent({ name: 'CwaUiAlertWarning' }).exists()).toBe(false)
      expect(layoutUiOptions(wrapper).some(o => o.label.includes('not found'))).toBe(false)
    })
  })
})
