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

const textFields: [string, Component, Record<string, unknown>, boolean][] = [
  ['CwaUiInput', Input, { modelValue: '', placeholder: 'https://your-site-domain.com' }, true],
  ['CwaUiTextarea', Textarea, { modelValue: '', placeholder: 'Intro' }, true],
  ['CwaUiNumber', NumberField, { modelValue: 2 }, false],
  ['CwaUiSegmented', Segmented, { modelValue: 'one', options }, false],
  ['CwaUiSelect', Select, { modelValue: undefined, options, placeholder: 'Choose…' }, false],
  ['CwaUiMultiSelect', MultiSelect, { modelValue: [], options, placeholder: 'Choose…' }, true],
  ['CwaUiResourceSearch', ResourceSearch, { modelValue: null, endpoint: '/_/routes', labelOf: () => '', placeholder: 'Search' }, true],
]

function classesIn(wrapper: ReturnType<typeof mountIn>) {
  return wrapper.findAll('*').flatMap(element => element.classes())
}

describe('a disabled kit field stays readable (#461)', () => {
  test.each(textFields)('%s, disabled, shows its value and placeholder in the disabled text colour, never faded with opacity or in the placeholder colour', async (_, component, props, nativePlaceholder) => {
    const wrapper = mountIn('bar', component, { ...props, disabled: true })
    await flushPromises()
    const classes = classesIn(wrapper)

    expect(classes.some(name => name.startsWith('cwa:text-fg-disabled'))).toBe(true)
    expect(classes).not.toContain('cwa:opacity-50')
    expect(classes).not.toContain('cwa:text-muted-on-field')
    expect(classes).not.toContain('cwa:placeholder:text-muted-on-field')
    expect(classes).not.toContain('cwa:text-fg/40')
    nativePlaceholder && expect(classes).toContain('cwa:placeholder:text-fg-disabled')
  })

  test.each(textFields)('%s, enabled, never uses the disabled text colour', async (_, component, props) => {
    const wrapper = mountIn('bar', component, props)
    await flushPromises()

    expect(classesIn(wrapper).some(name => name.startsWith('cwa:text-fg-disabled'))).toBe(false)
    expect(classesIn(wrapper)).not.toContain('cwa:placeholder:text-fg-disabled')
  })
})
