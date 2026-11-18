// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { computed, nextTick, ref } from 'vue'
import { axe } from '../../../../../../../../../test/utils/axe'
import Select from '#cwa/templates/components/ui/Select.vue'
import MultiSelect from '#cwa/templates/components/ui/MultiSelect.vue'
import Ui from './Ui.vue'

enableAutoUnmount(afterEach)

const stored = vi.hoisted(() => ({ uiComponent: undefined as any, uiClassNames: undefined as any }))
const savedUiComponent = ref<string | null>(null)
const currentStackItem = ref<any>(null)
const exposeMeta = { disabled: ref(false), fields: [] as string[] }

const mockCwa = {
  resources: { getResource: vi.fn(() => computed(() => ({ data: { uiComponent: savedUiComponent.value } }))) },
  admin: { resourceStackManager: { currentStackItem, currentIri: ref('/component/1') } },
}

vi.mock('#cwa/composables/cwa', () => ({ useCwa: () => mockCwa }))

vi.mock('#cwa/composables/cwa-resource-manager-tab', () => ({
  useCwaResourceManagerTab: () => ({
    iri: ref('/component/1'),
    $cwa: mockCwa,
    exposeMeta,
  }),
}))

vi.mock('#cwa/composables/cwa-resource-model', async () => {
  const { computed } = await vi.importActual<typeof import('vue')>('vue')
  return {
    useCwaResourceModel: (_iri: unknown, property: 'uiComponent' | 'uiClassNames', ops: { get?: (v: unknown) => unknown, set?: (v: unknown) => unknown } = {}) => ({
      model: computed({
        get: () => ops.get ? ops.get(stored[property].value) : stored[property].value,
        set: (value) => {
          stored[property].value = ops.set ? ops.set(value) : value
        },
      }),
      remoteChange: computed(() => undefined),
      state: computed(() => ({ status: 'idle', waiting: false, slow: false })),
    }),
  }
})

const resolvedMeta = vi.hoisted(() => ({ value: [] as any[] }))
vi.mock('#cwa/templates/components/core/useDataResolver', () => ({
  useDataResolver: (meta: { value: unknown[] }) => ({
    startDataResolver: () => {
      meta.value = resolvedMeta.value
    },
  }),
}))

function setStyles(multiple: boolean, ui: string[] = []) {
  currentStackItem.value = {
    ui,
    styles: { value: { multiple, classes: {
      Bordered: 'border border-gray-200',
      Rounded: 'rounded',
    } } },
  }
}

function mountUi() {
  return mount(Ui, { attachTo: document.body })
}

beforeEach(() => {
  stored.uiComponent = ref(null)
  stored.uiClassNames = ref(null)
  savedUiComponent.value = null
  resolvedMeta.value = []
  exposeMeta.fields.length = 0
})

describe('Ui tab on the kit (#460)', () => {
  test('is one manager-tab row whose fields are named for the tab badges', () => {
    setStyles(false)
    const wrapper = mountUi()

    expect(wrapper.find('[data-testid="manager-tab"]').exists()).toBe(true)
    expect(exposeMeta.fields).toEqual(['uiComponent', 'uiClassNames'])
  })

  test('offers the UI choices with Default first, named once their metadata resolves, and only when the component has any', async () => {
    setStyles(false, ['CwaComponentSplit'])
    resolvedMeta.value = [{ cwaResource: { name: 'Split image' } }]
    const wrapper = mountUi()
    await nextTick()

    const select = wrapper.getComponent(Select)
    expect(select.props('label')).toBe('UI')
    expect(select.props('noneLabel')).toBe('Default')
    expect(select.props('options')).toEqual([{ label: 'Split image', value: 'CwaComponentSplit' }])

    currentStackItem.value = { ui: ['CwaComponentSplit', 'CwaComponentWide'], styles: undefined }
    resolvedMeta.value = new Array(2)
    resolvedMeta.value[1] = { cwaResource: { name: 'Wide' } }
    const resolving = mountUi()
    await nextTick()
    expect(resolving.getComponent(Select).props('options')).toEqual([
      { label: 'CwaComponentSplit', value: 'CwaComponentSplit' },
      { label: 'Wide', value: 'CwaComponentWide' },
    ])

    currentStackItem.value = { ui: [], styles: undefined }
    resolvedMeta.value = []
    const plain = mountUi()
    expect(plain.findComponent(Select).exists()).toBe(false)
  })

  test('choosing another UI clears the styles once the new UI is saved', async () => {
    setStyles(false, ['CwaComponentSplit'])
    resolvedMeta.value = [{ cwaResource: { name: 'Split image' } }]
    stored.uiClassNames.value = ['rounded']
    const wrapper = mountUi()
    await nextTick()
    const model = wrapper.getComponent(Select).props('model') as { model: { value: unknown } }

    model.model.value = 'CwaComponentSplit'
    await nextTick()
    expect(stored.uiClassNames.value).toEqual(['rounded'])

    savedUiComponent.value = 'CwaComponentSplit'
    await flushPromises()
    expect(stored.uiClassNames.value).toBeNull()
  })

  describe('multiple styles, through a typed mapping from class strings to style names', () => {
    beforeEach(() => setStyles(true))

    test('a multi-select of style names shows the stored classes as names', () => {
      stored.uiClassNames.value = ['rounded']
      const wrapper = mountUi()
      const multi = wrapper.getComponent(MultiSelect)

      expect(multi.props('options')).toEqual([
        { label: 'Bordered', value: 'Bordered' },
        { label: 'Rounded', value: 'Rounded' },
      ])
      expect((multi.props('model') as { model: { value: unknown } }).model.value).toEqual(['Rounded'])
      expect(wrapper.get('[data-testid="multi-chip"]').text()).toContain('Rounded')
    })

    test('choosing styles stores one class string per style, and none stores null', () => {
      const wrapper = mountUi()
      const model = wrapper.getComponent(MultiSelect).props('model') as { model: { value: unknown } }

      model.model.value = ['Bordered', 'Rounded']
      expect(stored.uiClassNames.value).toEqual(['border border-gray-200', 'rounded'])

      model.model.value = []
      expect(stored.uiClassNames.value).toBeNull()
    })
  })

  describe('a single style', () => {
    beforeEach(() => setStyles(false))

    test('a nullable select of style names, with Default for none', () => {
      stored.uiClassNames.value = ['border border-gray-200']
      const wrapper = mountUi()
      const select = wrapper.getComponent(Select)

      expect(select.props('label')).toBe('Style')
      expect(select.props('noneLabel')).toBe('Default')
      expect((select.props('model') as { model: { value: unknown } }).model.value).toBe('Bordered')
      expect(wrapper.get('[data-testid="select-trigger"]').text()).toBe('Bordered')
    })

    test('choosing one stores a one-element uiClassNames, and Default stores null', () => {
      const wrapper = mountUi()
      const model = wrapper.getComponent(Select).props('model') as { model: { value: unknown } }

      model.model.value = 'Rounded'
      expect(stored.uiClassNames.value).toEqual(['rounded'])
      model.model.value = null
      expect(stored.uiClassNames.value).toBeNull()
    })
  })

  test('has no axe violations', async () => {
    setStyles(true, ['CwaComponentSplit'])
    resolvedMeta.value = [{ cwaResource: { name: 'Split image' } }]
    stored.uiClassNames.value = ['rounded', 'border border-gray-200']
    const wrapper = mountUi()
    await nextTick()

    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })
})
