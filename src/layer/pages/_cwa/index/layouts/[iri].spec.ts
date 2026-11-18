// @vitest-environment nuxt
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { computed, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import Select from '#cwa/templates/components/ui/Select.vue'
import Alert from '#cwa/templates/components/ui/Alert.vue'
import LayoutItemPage from './[iri].vue'
import { componentNames } from '#components'
import * as cwaComposable from '#cwa/composables/cwa'

const { mockUseItemPage, mockConfirm } = vi.hoisted(() => ({
  mockUseItemPage: vi.fn(),
  mockConfirm: vi.fn(),
}))

vi.mock('#cwa/composables/cwa-confirm', () => ({
  useCwaConfirm: () => mockConfirm,
}))

vi.mock('#cwa-layer/_composables/useItemPage', () => ({
  useItemPage: mockUseItemPage,
}))

const realtime = vi.hoisted(() => ({ peers: vi.fn((_iri: string): unknown[] => []) }))
vi.mock('#cwa/resources/realtime-view', () => ({
  realtimeView: () => ({ load: async () => ({ peers: realtime.peers }) }),
}))

const resolvableLayoutNames = componentNames.filter((n: string) => n.startsWith('CwaLayout'))
const resolvableLayoutName = resolvableLayoutNames[0]
const otherResolvableLayoutName = resolvableLayoutNames[1]
const unresolvableLayoutName = 'CwaLayoutRenamedAway'

const layoutsConfig = { [resolvableLayoutName.replace(/^CwaLayout/, '')]: { name: 'Configured Name' } }

function expectedResolvableOptions() {
  return resolvableLayoutNames.map((name: string) => {
    const cleanName = name.replace(/^CwaLayout/, '')
    return { label: layoutsConfig[cleanName]?.name || cleanName, value: name }
  })
}

function setup(opts: { uiComponent?: string | null, isAdding?: boolean, pages?: string[], unsavedFields?: string[] } = {}) {
  const localResourceData = ref<any>({
    '@id': '/_/layouts/uuid-self',
    '@type': 'Layout',
    'reference': 'My Layout',
    'uiComponent': opts.uiComponent === undefined ? resolvableLayoutName : opts.uiComponent,
    'uiClassNames': null,
    'createdAt': '2026-01-01',
    'updatedAt': '2026-01-02',
  })
  const resource = computed(() => ({ ...localResourceData.value, pages: opts.pages ?? [] }))
  const discard = vi.fn()
  const form = {
    unsavedFields: opts.unsavedFields ?? [],
    discard,
    model: (field: string) => ({
      field,
      model: computed({ get: () => localResourceData.value[field], set: (value) => { localResourceData.value[field] = value } }),
    }),
  }

  const saveResource = vi.fn()
  const deleteResource = vi.fn()

  mockUseItemPage.mockReturnValue({
    isAdding: ref(!!opts.isAdding),
    isLoading: ref(false),
    isUpdating: ref(false),
    localResourceData,
    resource,
    form,
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
      renderStubDefaultSlot: true,
      stubs: {
        CwaUiDialog: {
          name: 'Dialog',
          props: ['title', 'tabs', 'form', 'loading', 'noun', 'createNoun'],
          emits: ['close', 'save'],
          template: '<div><slot name="details" /><slot name="info" /></div>',
        },
      },
    },
  })

  return { wrapper, localResourceData, saveResource, deleteResource, discard }
}

type Wrapper = ReturnType<typeof setup>['wrapper']

function layoutUiSelect(wrapper: Wrapper) {
  return wrapper.findAllComponents(Select).find(s => s.props('label') === 'Layout UI')
}

function warning(wrapper: Wrapper) {
  return wrapper.findAllComponents(Alert).find(alert => alert.attributes('data-testid') === 'layout-unresolvable')
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

    test('the Layout UI select edits the layout\'s uiComponent through the dialog\'s form', () => {
      const { wrapper } = setup()
      expect(layoutUiSelect(wrapper)!.props('field')).toBe('uiComponent')
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
      expect(warning(wrapper)).toBeUndefined()
    })
  })

  describe('when the stored uiComponent is empty', () => {
    test('adds no extra option and shows no warning', () => {
      const { wrapper } = setup({ uiComponent: null })
      expect(layoutUiOptions(wrapper)).toEqual(expectedResolvableOptions())
      expect(warning(wrapper)).toBeUndefined()
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
      const alert = warning(wrapper)!
      expect(alert.props('tone')).toBe('warning')
      expect(alert.text()).toContain(`The component '${unresolvableLayoutName}' for resource '/_/layouts/uuid-self' cannot be resolved`)
    })

    test('does not mutate the stored resource data', () => {
      const { wrapper, localResourceData, saveResource } = setup({ uiComponent: unresolvableLayoutName })
      expect(wrapper.exists()).toBe(true)
      expect(localResourceData.value.uiComponent).toBe(unresolvableLayoutName)
      expect(saveResource).not.toHaveBeenCalled()
    })

    test('choosing a real option from the select replaces the unresolvable value and clears the warning', async () => {
      const { wrapper, localResourceData } = setup({ uiComponent: unresolvableLayoutName })
      localResourceData.value.uiComponent = resolvableLayoutName
      await flushPromises()
      expect(warning(wrapper)).toBeUndefined()
      expect(layoutUiOptions(wrapper).some(o => o.label.includes('not found'))).toBe(false)
    })
  })
})

describe('Layout admin dialog (#461)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const dialog = (wrapper: Wrapper) => wrapper.findComponent({ name: 'Dialog' })

  test('editing, it is titled by the layout\'s reference with Details and Info', () => {
    const { wrapper } = setup()

    expect(dialog(wrapper).props('title')).toBe('My Layout')
    expect(dialog(wrapper).props('tabs').map((tab: { key: string }) => tab.key)).toEqual(['details', 'info'])
    expect(dialog(wrapper).props('createNoun')).toBeUndefined()
  })

  test('creating, it is a "New layout" with Details only and a "+ Layout" save', () => {
    const { wrapper } = setup({ isAdding: true })

    expect(dialog(wrapper).props('title')).toBe('New layout')
    expect(dialog(wrapper).props('tabs').map((tab: { key: string }) => tab.key)).toEqual(['details'])
    expect(dialog(wrapper).props('createNoun')).toBe('layout')
  })

  test('creates layouts at /_/layouts with the first layout UI chosen, clearing errors stored before', () => {
    setup({ isAdding: true })
    const options = mockUseItemPage.mock.calls[0]![0]

    expect(options.createEndpoint).toBe('/_/layouts')
    expect(options.dismissStoredErrors).toBe(true)
    expect(options.defaultResource()).toEqual({ reference: null, uiComponent: resolvableLayoutName })
  })

  test('the delete section says how many pages use the layout', () => {
    const { wrapper } = setup({ pages: ['/_/pages/1', '/_/pages/2'] })

    expect(wrapper.find('[data-testid="layout-delete-section"]').attributes('description')).toBe('2 pages use this layout.')
  })

  test('delete asks for the layout name to be typed, naming the pages and unsaved changes, and deletes without asking again', async () => {
    mockConfirm.mockResolvedValue(true)
    const { wrapper, deleteResource, discard } = setup({ pages: ['/_/pages/1'], unsavedFields: ['reference'] })

    await wrapper.get('[data-testid="layout-delete"]').trigger('click')
    await vi.dynamicImportSettled()
    await flushPromises()

    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Delete “My Layout”?',
      lines: [
        { text: '1 page uses this layout.', emphasis: 'strong' },
        { text: 'Your 1 unsaved change is discarded too.' },
        { text: 'This can\'t be undone.' },
      ],
      typed: { noun: 'layout name', value: 'My Layout' },
    }))
    expect(deleteResource).toHaveBeenCalledWith(undefined, expect.any(Function), true)
    deleteResource.mock.calls[0]![1]()
    expect(discard).toHaveBeenCalled()
  })

  test('the confirm names the other admins editing the layout, as the old delete did (#429)', async () => {
    realtime.peers.mockReturnValueOnce([
      { user: { id: '/users/sam', name: 'Sam' }, name: 'Sam', state: 'editing', idle: false },
    ])
    mockConfirm.mockResolvedValue(false)
    const { wrapper } = setup()

    await wrapper.get('[data-testid="layout-delete"]').trigger('click')
    await vi.dynamicImportSettled()
    await flushPromises()

    expect(realtime.peers).toHaveBeenCalledWith('/_/layouts/uuid-self')
    expect(mockConfirm.mock.calls[0]![0].lines).toEqual([
      { text: 'Sam is editing this.' },
      { text: 'This can\'t be undone.' },
    ])
  })

  test('a delete that is not confirmed deletes nothing', async () => {
    mockConfirm.mockResolvedValue(false)
    const { wrapper, deleteResource } = setup()

    await wrapper.get('[data-testid="layout-delete"]').trigger('click')
    await vi.dynamicImportSettled()
    await flushPromises()

    expect(deleteResource).not.toHaveBeenCalled()
  })
})
