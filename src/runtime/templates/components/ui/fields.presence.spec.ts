// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import type { Component } from 'vue'
import { axe } from '../../../../../test/utils/axe'
import { fakeFieldModel } from '../../../../../playground/app/kit/fake-field-model'
import { formSurfaceKey } from '../core/ui/field-keys'
import type { FocusedPeer } from '#cwa/admin/presence'
import Input from './Input.vue'
import Textarea from './Textarea.vue'
import Toggle from './Toggle.vue'
import Num from './Number.vue'
import Segmented from './Segmented.vue'
import Select from './Select.vue'
import MultiSelect from './MultiSelect.vue'
import DatePicker from './DatePicker.vue'
import ResourceSearch from './ResourceSearch.vue'

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: () => ({ resources: { getResource: () => ({ value: undefined }) } }),
}))

enableAutoUnmount(afterEach)

const MIA = { user: { id: '/_/users/mia', name: 'Mia' }, name: 'Mia', colour: '#d946ef', isSelf: false, clientIds: ['tab-mia'] } as FocusedPeer

function presenceModel<T>(initial: T, peers: FocusedPeer[] = []) {
  const focused = ref(peers)
  const listeners = { onFocusin: vi.fn(), onFocusout: vi.fn(), onPointerdown: vi.fn() }
  return {
    ...fakeFieldModel(initial),
    focusedBy: computed(() => focused.value),
    focusListeners: listeners,
    blur: vi.fn(),
  }
}

const modal = { [formSurfaceKey as symbol]: { unsaved: () => false, register: () => () => {} } }

interface Case {
  name: string
  component: Component
  value: unknown
  props?: Record<string, unknown>
  provide?: Record<symbol, unknown>
  control: string
  canBeReadonly?: boolean
}

const cases: Case[] = [
  { name: 'CwaUiInput', component: Input, value: 'Summer menu', control: 'input', canBeReadonly: true },
  { name: 'CwaUiTextarea', component: Textarea, value: 'Served all day', provide: modal, control: 'textarea', canBeReadonly: true },
  { name: 'CwaUiToggle', component: Toggle, value: false, control: '[role="switch"]' },
  { name: 'CwaUiNumber', component: Num, value: 3, props: { min: 1, max: 6 }, control: 'input' },
  { name: 'CwaUiSegmented', component: Segmented, value: 'page', props: { options: [{ value: 'page', label: 'Page' }, { value: 'url', label: 'URL' }] }, control: 'button' },
  { name: 'CwaUiSelect', component: Select, value: 'wide', props: { options: [{ label: 'Wide', value: 'wide' }, { label: 'Narrow', value: 'narrow' }] }, control: '[data-testid="select-trigger"]' },
  { name: 'CwaUiMultiSelect', component: MultiSelect, value: ['dark'], props: { options: [{ label: 'Dark', value: 'dark' }, { label: 'Padding', value: 'padding' }] }, control: 'input' },
  { name: 'CwaUiDatePicker', component: DatePicker, value: null, control: '[data-reka-date-field-segment]' },
  { name: 'CwaUiResourceSearch', component: ResourceSearch, value: null, props: { endpoint: '/_/routes', load: () => new Promise(() => {}) }, control: 'input' },
]

function mountCase(item: Case, model: ReturnType<typeof presenceModel>, props: Record<string, unknown> = {}) {
  return mount(item.component, {
    props: { label: 'Field', model, ...item.props, ...props },
    global: { provide: item.provide },
    attachTo: document.body,
  })
}

describe.each(cases)('$name shows co-editing presence (#461)', (item) => {
  test('another editor in the field outlines it and names them on its flag', async () => {
    const wrapper = mountCase(item, presenceModel(item.value, [MIA]))
    await flushPromises()

    const outline = wrapper.get('[data-testid="field-presence"]')
    expect(outline.attributes('style')).toContain('box-shadow: inset 0 0 0 2px #d946ef')
    expect(wrapper.get('[data-testid="field-presence-flag"]').text()).toBe('Mia')
    expect(outline.element.parentElement!.contains(wrapper.get(item.control).element)).toBe(true)
    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })

  test.each([
    ['a manager row', {}],
    ['a dialog', modal],
  ])('in %s the outline and flag sit on the control, never over its visible label', async (_place, surface) => {
    const wrapper = mount(item.component, {
      props: { label: 'Field', model: presenceModel(item.value, [MIA]), ...item.props },
      global: { provide: { ...surface, ...item.provide } },
      attachTo: document.body,
    })
    await flushPromises()

    const presenceRoot = wrapper.get('[data-testid="field-presence"]').element.parentElement!
    const labels = [...wrapper.element.parentElement!.querySelectorAll('label')].filter(label => label.textContent?.trim() === 'Field' && !label.closest('.cwa\\:sr-only') && !label.classList.contains('cwa:sr-only'))
    expect(labels).toHaveLength(1)
    expect(presenceRoot.contains(labels[0]!)).toBe(false)
  })

  test('shows no one while no one else is in the field', async () => {
    const wrapper = mountCase(item, presenceModel(item.value))
    await flushPromises()

    expect(wrapper.find('[data-testid="field-presence"]').exists()).toBe(false)
    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })

  test('focusing the control and pressing on it report this editor in the field', async () => {
    const model = presenceModel(item.value)
    const wrapper = mountCase(item, model)
    const control = wrapper.get(item.control)

    await control.trigger('focusin')
    control.element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    control.element.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))

    expect(model.focusListeners.onFocusin).toHaveBeenCalledOnce()
    expect(model.focusListeners.onPointerdown).toHaveBeenCalledOnce()
    expect(model.focusListeners.onFocusout).toHaveBeenCalledOnce()
  })

  test('a focused field that becomes disabled reports leaving it (#476 review 3)', async () => {
    const model = presenceModel(item.value)
    const wrapper = mountCase(item, model)
    await wrapper.get(item.control).trigger('focusin')
    expect(model.blur).not.toHaveBeenCalled()

    await wrapper.setProps({ disabled: true })

    expect(model.blur).toHaveBeenCalledOnce()
  })

  test('a disabled field reports nothing, and still shows who is in it', async () => {
    const model = presenceModel(item.value, [MIA])
    const wrapper = mountCase(item, model, { disabled: true })
    await flushPromises()
    const control = wrapper.get(item.control)

    await control.trigger('focusin')
    control.element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    control.element.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))

    expect(model.focusListeners.onFocusin).not.toHaveBeenCalled()
    expect(model.focusListeners.onPointerdown).not.toHaveBeenCalled()
    expect(model.focusListeners.onFocusout).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="field-presence-flag"]').text()).toBe('Mia')
    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })

  test.runIf(item.canBeReadonly)('a read-only field reports nothing', async () => {
    const model = presenceModel(item.value)
    const wrapper = mountCase(item, model, { readonly: true })
    const control = wrapper.get(item.control)

    await control.trigger('focusin')
    control.element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))

    expect(model.focusListeners.onFocusin).not.toHaveBeenCalled()
    expect(model.focusListeners.onPointerdown).not.toHaveBeenCalled()
  })
})
