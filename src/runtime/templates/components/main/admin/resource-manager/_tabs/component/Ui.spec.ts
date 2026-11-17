// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import Ui from './Ui.vue'

const uiComponentModel = ref<string | null>(null)
const uiClassNamesModel = ref<string[] | null>(null)
const savedResource = ref<any>({ data: { '@type': 'Hero', 'uiComponent': null } })

const currentStackItem = ref<any>(null)

const mockCwa = {
  resources: { getResource: vi.fn(() => savedResource) },
  admin: { resourceStackManager: { currentStackItem, currentIri: ref('/component/1') } },
}

const config = vi.hoisted(() => ({
  resourcesConfig: {} as Record<string, any>,
  uiConfig: {} as Record<string, any>,
}))

vi.mock('#build/cwa-config', () => config)

vi.mock('#cwa/composables/cwa-resource-manager-tab', () => ({
  useCwaResourceManagerTab: () => ({
    iri: ref('/component/1'),
    $cwa: mockCwa,
    exposeMeta: { disabled: ref(false) },
  }),
}))

vi.mock('#cwa/composables/cwa-resource-model', () => ({
  useCwaResourceModel: (_iri: any, property: string) => ({
    model: property === 'uiClassNames' ? uiClassNamesModel : uiComponentModel,
  }),
}))

vi.mock('#cwa/composables/cwa-select', () => ({
  useCwaSelect: (model: any) => ({ model, options: ref([]) }),
}))

const CwaUiSelectStub = {
  name: 'CwaUiSelect',
  props: {
    modelValue: { type: null },
    options: { type: Array },
    multiple: { type: Boolean, default: false },
    placeholder: { type: String },
  },
  emits: ['update:modelValue'],
  template: '<div class="cwa-ui-select" />',
}
const stubs = {
  CwaUiSelect: CwaUiSelectStub,
  CwaUiFormLabelWrapper: { template: '<div><slot /></div>' },
}

function mountUi() {
  return mount(Ui, { global: { stubs } })
}

function uiSelect(wrapper: ReturnType<typeof mountUi>) {
  return wrapper.findAllComponents(CwaUiSelectStub).at(0)!
}

function styleSelect(wrapper: ReturnType<typeof mountUi>) {
  return wrapper.findAllComponents(CwaUiSelectStub).at(-1)!
}

function setStyles(multipleStyles: boolean) {
  uiComponentModel.value = null
  uiClassNamesModel.value = null
  savedResource.value = { data: { '@type': 'Hero', 'uiComponent': null } }
  currentStackItem.value = { ui: ['CwaComponentHeroUiTall'] }
  config.resourcesConfig = {
    Hero: {
      multipleStyles,
      styles: {
        bordered: { label: 'Bordered', classes: 'border border-gray-200' },
        rounded: { label: 'Rounded', classes: 'rounded' },
      },
    },
  }
  config.uiConfig = {
    CwaComponentHeroUiTall: {
      styles: { tall: { label: 'Tall', classes: 'h-screen' } },
    },
  }
}

describe('Ui tab — multiple styles', () => {
  beforeEach(() => setStyles(true))

  test('renders the styles select in multiple mode, with the labels as options, not the class strings', () => {
    const wrapper = mountUi()
    const select = styleSelect(wrapper)
    expect(select.props('multiple')).toBe(true)
    expect(select.props('options')).toEqual([
      { label: 'Bordered', value: 'bordered' },
      { label: 'Rounded', value: 'rounded' },
    ])
  })

  test('reflects the selected styles from the stored keys', () => {
    uiClassNamesModel.value = ['style:rounded']
    const wrapper = mountUi()
    expect(styleSelect(wrapper).props('modelValue')).toEqual(['rounded'])
  })

  test('stores each chosen key as style:<key>', async () => {
    const wrapper = mountUi()
    styleSelect(wrapper).vm.$emit('update:modelValue', ['bordered', 'rounded'])
    await nextTick()
    expect(uiClassNamesModel.value).toEqual(['style:bordered', 'style:rounded'])
  })

  test('clearing the selection writes null', async () => {
    uiClassNamesModel.value = ['style:rounded']
    const wrapper = mountUi()
    styleSelect(wrapper).vm.$emit('update:modelValue', [])
    await nextTick()
    expect(uiClassNamesModel.value).toBeNull()
  })
})

describe('Ui tab — single style', () => {
  beforeEach(() => setStyles(false))

  test('renders a single select with a Default option plus the labels', () => {
    const wrapper = mountUi()
    const select = styleSelect(wrapper)
    expect(select.props('multiple')).toBe(false)
    expect(select.props('options')).toEqual([
      { label: 'Default', value: null },
      { label: 'Bordered', value: 'bordered' },
      { label: 'Rounded', value: 'rounded' },
    ])
  })

  test('choosing a style stores style:<key>', async () => {
    const wrapper = mountUi()
    styleSelect(wrapper).vm.$emit('update:modelValue', 'bordered')
    await nextTick()
    expect(uiClassNamesModel.value).toEqual(['style:bordered'])
  })

  test('reflects the current single selection as its key', () => {
    uiClassNamesModel.value = ['style:bordered']
    const wrapper = mountUi()
    expect(styleSelect(wrapper).props('modelValue')).toBe('bordered')
  })

  test('selecting Default (null) clears uiClassNames', async () => {
    uiClassNamesModel.value = ['style:rounded']
    const wrapper = mountUi()
    styleSelect(wrapper).vm.$emit('update:modelValue', null)
    await nextTick()
    expect(uiClassNamesModel.value).toBeNull()
  })
})

describe('Ui tab — styles come from the generated config (#453)', () => {
  beforeEach(() => setStyles(false))

  test('the tab no longer mounts components to find out their styles: the stack item carries none, and the options still show', () => {
    expect(currentStackItem.value.styles).toBeUndefined()
    const wrapper = mountUi()
    expect(styleSelect(wrapper).props('options')).toEqual([
      { label: 'Default', value: null },
      { label: 'Bordered', value: 'bordered' },
      { label: 'Rounded', value: 'rounded' },
    ])
  })

  test('a variant\'s name comes from its defineCwaConfig', async () => {
    config.uiConfig.CwaComponentHeroUiTall.name = 'Tall hero'
    currentStackItem.value = { ui: ['CwaComponentHeroUiTall', 'CwaComponentHeroUiWide'] }
    const wrapper = mountUi()
    await nextTick()
    expect(uiSelect(wrapper).props('options')).toEqual([
      { label: 'Default', value: null },
      { label: 'Tall hero', value: 'CwaComponentHeroUiTall' },
      { label: 'CwaComponentHeroUiWide', value: 'CwaComponentHeroUiWide' },
    ])
  })

  test('a UI variant offers its own styles', () => {
    savedResource.value = { data: { '@type': 'Hero', 'uiComponent': 'CwaComponentHeroUiTall' } }
    const wrapper = mountUi()
    expect(styleSelect(wrapper).props('options')).toEqual([
      { label: 'Default', value: null },
      { label: 'Tall', value: 'tall' },
    ])
  })

  test('a key the variant does not know shows no style selected, and choosing one keeps the other key', async () => {
    savedResource.value = { data: { '@type': 'Hero', 'uiComponent': 'CwaComponentHeroUiTall' } }
    uiClassNamesModel.value = ['style:bordered']
    const wrapper = mountUi()
    expect(styleSelect(wrapper).props('modelValue')).toBeNull()

    styleSelect(wrapper).vm.$emit('update:modelValue', 'tall')
    await nextTick()
    expect(uiClassNamesModel.value).toEqual(['style:bordered', 'style:tall'])
  })

  test('switching UI variant keeps the stored keys the new variant defines and drops the rest', async () => {
    config.uiConfig.CwaComponentHeroUiTall.styles.bordered = { label: 'Bordered', classes: 'border-4' }
    uiClassNamesModel.value = ['style:bordered', 'style:rounded', 'legacy classes']
    const wrapper = mountUi()
    await nextTick()

    uiSelect(wrapper).vm.$emit('update:modelValue', 'CwaComponentHeroUiTall')
    await nextTick()
    expect(uiComponentModel.value).toBe('CwaComponentHeroUiTall')
    expect(uiClassNamesModel.value).toEqual(['style:bordered', 'style:rounded', 'legacy classes'])

    savedResource.value = { data: { '@type': 'Hero', 'uiComponent': 'CwaComponentHeroUiTall' } }
    await nextTick()
    expect(uiClassNamesModel.value).toEqual(['style:bordered'])
  })

  test('switching UI variant to one defining none of the stored keys stores null', async () => {
    uiClassNamesModel.value = ['style:rounded']
    const wrapper = mountUi()
    await nextTick()

    uiSelect(wrapper).vm.$emit('update:modelValue', 'CwaComponentHeroUiTall')
    await nextTick()
    savedResource.value = { data: { '@type': 'Hero', 'uiComponent': 'CwaComponentHeroUiTall' } }
    await nextTick()
    expect(uiClassNamesModel.value).toBeNull()
  })

  test('selecting another component with a different UI variant leaves its stored keys alone', async () => {
    uiClassNamesModel.value = ['style:rounded']
    mountUi()

    savedResource.value = { data: { '@type': 'Hero', 'uiComponent': 'CwaComponentHeroUiTall' } }
    await nextTick()
    expect(uiClassNamesModel.value).toEqual(['style:rounded'])
  })
})
