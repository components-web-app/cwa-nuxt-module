// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import Ui from './Ui.vue'

// Model refs the mocked useCwaResourceModel hands back, so the test can inspect what the styles
// select writes to `uiClassNames`.
const uiComponentModel = ref<string | null>(null)
const uiClassNamesModel = ref<string[] | null>(null)

const currentStackItem = ref<any>(null)

const mockCwa = {
  resources: { getResource: vi.fn(() => ref({ data: { uiComponent: null } })) },
  admin: { resourceStackManager: { currentStackItem, currentIri: ref('/component/1') } },
}

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
  useCwaSelect: (model: any) => ({ model: ref(model.value), options: ref([]) }),
}))

vi.mock('#cwa/templates/components/core/useDataResolver', () => ({
  useDataResolver: () => ({ startDataResolver: vi.fn() }),
}))

// Stub the kit Select so we can read its props and drive its v-model.
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

function setStyles(multiple: boolean) {
  uiComponentModel.value = null
  uiClassNamesModel.value = null
  currentStackItem.value = {
    ui: [],
    styles: { value: { multiple, classes: {
      Bordered: 'border border-gray-200',
      Rounded: 'rounded',
    } } },
  }
}

describe('Ui tab — multiple styles', () => {
  beforeEach(() => setStyles(true))

  test('renders the styles select in multiple mode with style-name options', () => {
    const wrapper = mountUi()
    const select = wrapper.findComponent(CwaUiSelectStub)
    expect(select.props('multiple')).toBe(true)
    expect(select.props('options')).toEqual([
      { label: 'Bordered', value: 'Bordered' },
      { label: 'Rounded', value: 'Rounded' },
    ])
  })

  test('reflects the currently-selected styles derived from uiClassNames', () => {
    uiClassNamesModel.value = ['rounded']
    const wrapper = mountUi()
    expect(wrapper.findComponent(CwaUiSelectStub).props('modelValue')).toEqual(['Rounded'])
  })

  test('selecting styles writes one merged uiClassNames entry per style', async () => {
    const wrapper = mountUi()
    wrapper.findComponent(CwaUiSelectStub).vm.$emit('update:modelValue', ['Bordered', 'Rounded'])
    await nextTick()
    expect(uiClassNamesModel.value).toEqual(['border border-gray-200', 'rounded'])
  })

  test('clearing the selection writes null', async () => {
    uiClassNamesModel.value = ['rounded']
    const wrapper = mountUi()
    wrapper.findComponent(CwaUiSelectStub).vm.$emit('update:modelValue', [])
    await nextTick()
    expect(uiClassNamesModel.value).toBeNull()
  })
})

describe('Ui tab — single style', () => {
  beforeEach(() => setStyles(false))

  test('renders a single (non-multiple) select with a Default option plus style names', () => {
    const wrapper = mountUi()
    const select = wrapper.findComponent(CwaUiSelectStub)
    expect(select.props('multiple')).toBe(false)
    expect(select.props('options')).toEqual([
      { label: 'Default', value: null },
      { label: 'Bordered', value: 'Bordered' },
      { label: 'Rounded', value: 'Rounded' },
    ])
  })

  test('selecting one style stores a one-element uiClassNames', async () => {
    const wrapper = mountUi()
    wrapper.findComponent(CwaUiSelectStub).vm.$emit('update:modelValue', 'Bordered')
    await nextTick()
    expect(uiClassNamesModel.value).toEqual(['border border-gray-200'])
  })

  test('reflects the current single selection as its style name', () => {
    uiClassNamesModel.value = ['border border-gray-200']
    const wrapper = mountUi()
    expect(wrapper.findComponent(CwaUiSelectStub).props('modelValue')).toBe('Bordered')
  })

  test('selecting Default (null) clears uiClassNames', async () => {
    uiClassNamesModel.value = ['rounded']
    const wrapper = mountUi()
    wrapper.findComponent(CwaUiSelectStub).vm.$emit('update:modelValue', null)
    await nextTick()
    expect(uiClassNamesModel.value).toBeNull()
  })
})
