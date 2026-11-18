// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { computed, defineComponent, h, provide, ref } from 'vue'
import type { Component } from 'vue'
import { formSurfaceKey } from '../core/ui/field-keys'
import Input from './Input.vue'
import Textarea from './Textarea.vue'
import NumberField from './Number.vue'
import Toggle from './Toggle.vue'
import Segmented from './Segmented.vue'
import Select from './Select.vue'
import MultiSelect from './MultiSelect.vue'
import DatePicker from './DatePicker.vue'
import ResourceSearch from './ResourceSearch.vue'
import FileUpload from './FileUpload.vue'
import type { CwaUploadField } from './FileUpload.vue'

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: () => ({ resources: { getResource: () => ({ value: undefined }) } }),
}))
vi.mock('#cwa/composables/cwa-resource-upload', () => ({ useCwaResourceUpload: vi.fn() }))

enableAutoUnmount(afterEach)

const REASON = 'Choose a layout first.'
const options = [{ label: 'One', value: 'one' }, { label: 'Two', value: 'two' }]
const upload: CwaUploadField = {
  file: computed(() => undefined),
  state: computed(() => ({ status: 'idle', waiting: false, slow: false })),
  updating: ref(false),
  handleInputChangeFile: vi.fn(async () => {}),
  handleInputDeleteFile: vi.fn(async () => {}),
  retry: vi.fn(async () => {}),
  reset: vi.fn(async () => {}),
}

const fields: [string, Component, Record<string, unknown>][] = [
  ['CwaUiInput', Input, { modelValue: 'Kitchens' }],
  ['CwaUiTextarea', Textarea, { modelValue: 'Kitchens' }],
  ['CwaUiNumber', NumberField, { modelValue: 2 }],
  ['CwaUiToggle', Toggle, { modelValue: true }],
  ['CwaUiSegmented', Segmented, { modelValue: 'one', options }],
  ['CwaUiSelect', Select, { modelValue: 'one', options }],
  ['CwaUiMultiSelect', MultiSelect, { modelValue: ['one'], options }],
  ['CwaUiDatePicker', DatePicker, { modelValue: null }],
  ['CwaUiResourceSearch', ResourceSearch, { modelValue: null, endpoint: '/_/routes', labelOf: () => '' }],
  ['CwaUiFileUpload', FileUpload, { upload }],
]

function mountIn(surface: 'bar' | 'dialog', component: Component, props: Record<string, unknown>) {
  return mount(defineComponent({
    setup() {
      surface === 'dialog' && provide(formSurfaceKey, { unsaved: () => false, register: () => () => {} })
      return () => h(component, { label: 'Layout', ...props })
    },
  }), { attachTo: document.body })
}

function reasonText(wrapper: ReturnType<typeof mountIn>) {
  return wrapper.findAll('.cwa\\:sr-only').map(element => element.text()).join(' ')
}

describe('disabledReason on every kit field (#461)', () => {
  describe.each(['bar', 'dialog'] as const)('in a %s', (surface) => {
    test.each(fields)('%s, disabled with a reason, says why behind its ⓘ, which stays reachable', async (_, component, props) => {
      const wrapper = mountIn(surface, component, { ...props, disabled: true, disabledReason: REASON })
      await flushPromises()

      expect(reasonText(wrapper)).toContain(REASON)
      expect(wrapper.find('[data-testid="field-info"]').exists()).toBe(true)
    })

    test.each(fields)('%s, enabled, keeps the reason to itself', async (_, component, props) => {
      const wrapper = mountIn(surface, component, { ...props, disabledReason: REASON })
      await flushPromises()

      expect(wrapper.text()).not.toContain(REASON)
      expect(reasonText(wrapper)).not.toContain(REASON)
    })
  })
})
