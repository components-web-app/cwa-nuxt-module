// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, nextTick, ref, shallowRef } from 'vue'
import type { RemoteFieldChange } from '#cwa/resources/model-editors'
import type { FocusedPeer } from '#cwa/admin/presence'
import Input from './Input.vue'
import Toggle from './Toggle.vue'
import Select from '../Select.vue'

vi.mock('#cwa/composables/popper', () => ({
  usePopper: vi.fn(() => [ref(null), ref(null)]),
}))

function fieldModel<T>(initial: T) {
  const value = ref<T | null | undefined>(initial)
  const change = shallowRef<RemoteFieldChange<T>>()
  const peers = ref<FocusedPeer[]>([])
  return {
    model: computed({ get: () => value.value, set: (next) => {
      value.value = next
    } }),
    remoteChange: computed(() => change.value),
    focusListeners: { onFocusin: vi.fn(), onFocusout: vi.fn(), onPointerdown: vi.fn() },
    focusedBy: computed(() => peers.value),
    value,
    change,
    peers,
  }
}

function conflict<T>(value: T, name: string) {
  return { value, name, accept: vi.fn(), keep: vi.fn() }
}

describe('kit fields bound to a resource model (#429)', () => {
  test('CwaUiFormInput shows and writes the model', async () => {
    const model = fieldModel('Mine')
    const wrapper = mount(Input, { props: { model } })
    const input = wrapper.get('input')

    expect(input.element.value).toBe('Mine')
    await input.setValue('Edited')
    expect(model.value.value).toBe('Edited')
  })

  test('CwaUiFormInput keeps its v-model behaviour without a model', async () => {
    const wrapper = mount(Input, { props: { 'modelValue': 'Plain', 'onUpdate:modelValue': (value: unknown) => wrapper.setProps({ modelValue: value as string }) } })

    expect(wrapper.element.tagName).toBe('INPUT')
    await wrapper.get('input').setValue('Changed')
    expect(wrapper.emitted('update:modelValue')?.[0]).toStrictEqual(['Changed'])
  })

  test('a conflict shows in the field\'s own row with the editor\'s name, and its buttons choose', async () => {
    const model = fieldModel('Mine')
    const wrapper = mount(Input, { props: { model } })
    expect(wrapper.find('[data-testid="remote-change"]').exists()).toBe(false)

    const change = conflict('Theirs', 'Sam')
    model.change.value = change
    await nextTick()

    const row = wrapper.get('[data-testid="remote-change"]')
    expect(row.text()).toContain('Sam changed this')
    await row.get('[data-testid="remote-change-accept"]').trigger('click')
    expect(change.accept).toHaveBeenCalledOnce()
    await row.get('[data-testid="remote-change-keep"]').trigger('click')
    expect(change.keep).toHaveBeenCalledOnce()
    expect(wrapper.get('input').element.value).toBe('Mine')
  })

  test('CwaUiFormToggle writes the model and shows a conflict', async () => {
    const model = fieldModel<boolean>(false)
    model.change.value = conflict(true, 'Sam')
    const wrapper = mount(Toggle, { props: { label: 'Visible', model } })

    await wrapper.get('button').trigger('click')
    expect(model.value.value).toBe(true)
    expect(wrapper.get('[data-testid="remote-change"]').text()).toContain('Sam changed this')
  })

  test('CwaUiSelect shows the model\'s option and shows a conflict', async () => {
    const model = fieldModel('b')
    model.change.value = conflict('a', 'Sam')
    const wrapper = mount(Select, { props: { model, options: [{ label: 'First', value: 'a' }, { label: 'Second', value: 'b' }] } })

    const trigger = wrapper.get('button')
    expect(trigger.text()).toContain('Second')
    expect(wrapper.get('[data-testid="remote-change"]').text()).toContain('Sam changed this')
  })

  test('CwaUiSelect writes a chosen option to the model', async () => {
    const model = fieldModel('b')
    const wrapper = mount(Select, { props: { model, options: [{ label: 'First', value: 'a' }, { label: 'Second', value: 'b' }] }, attachTo: document.body })

    await wrapper.get('button').trigger('click')
    await wrapper.findAll('li').find(item => item.text() === 'First')!.trigger('click')

    expect(model.value.value).toBe('a')
    wrapper.unmount()
  })

  describe('focus is reported to co-editing presence (#429)', () => {
    const options = [{ label: 'First', value: 'a' }, { label: 'Second', value: 'b' }]

    test.each([
      ['CwaUiFormInput', Input, 'Mine', {}, 'input'],
      ['CwaUiFormToggle', Toggle, false, { label: 'Visible' }, 'button'],
      ['CwaUiSelect', Select, 'b', { options }, 'button'],
    ] as const)('%s binds the model\'s focusListeners on the element holding the whole field and its conflict', async (_name, component, initial, props, control) => {
      const model = fieldModel<any>(initial)
      model.change.value = conflict(initial, 'Sam')
      const roots: Element[] = []
      for (const listener of Object.values(model.focusListeners)) {
        listener.mockImplementation((event: Event) => roots.push(event.currentTarget as Element))
      }
      const wrapper = mount(component as any, { props: { ...props, model }, attachTo: document.body })
      const target = wrapper.get(control)

      await target.trigger('focusin')
      await target.trigger('pointerdown')
      await target.trigger('focusout')

      expect(model.focusListeners.onFocusin).toHaveBeenCalledOnce()
      expect(model.focusListeners.onPointerdown).toHaveBeenCalledOnce()
      expect(model.focusListeners.onFocusout).toHaveBeenCalledOnce()
      expect(new Set(roots).size).toBe(1)
      expect(roots[0]!.contains(wrapper.get('[data-testid="remote-change"]').element)).toBe(true)
      wrapper.unmount()
    })
  })

  describe('a disabled field never reports focus (#429)', () => {
    test.each([
      ['CwaUiFormInput', Input, 'Mine', { disabled: true }, 'input'],
      ['CwaUiFormToggle', Toggle, false, { label: 'Visible', disabled: true }, 'button'],
    ] as const)('%s, clicked while disabled, reports nothing to presence', async (_name, component, initial, props, control) => {
      const model = fieldModel<any>(initial)
      const wrapper = mount(component as any, { props: { ...props, model }, attachTo: document.body })

      await wrapper.trigger('pointerdown')
      await wrapper.get(control).trigger('pointerdown')
      await wrapper.get(control).trigger('focusin')

      expect(model.focusListeners.onPointerdown).not.toHaveBeenCalled()
      expect(model.focusListeners.onFocusin).not.toHaveBeenCalled()
      wrapper.unmount()
    })

    test.each([
      ['CwaUiFormInput', Input, 'Mine', {}, 'input'],
      ['CwaUiFormToggle', Toggle, false, { label: 'Visible' }, 'button'],
    ] as const)('%s reports focus again once enabled', async (_name, component, initial, props, control) => {
      const model = fieldModel<any>(initial)
      const wrapper = mount(component as any, { props: { ...props, disabled: true, model }, attachTo: document.body })

      await wrapper.setProps({ disabled: false })
      await wrapper.get(control).trigger('pointerdown')

      expect(model.focusListeners.onPointerdown).toHaveBeenCalledOnce()
      wrapper.unmount()
    })
  })

  describe('another admin in the field is shown on it (#429)', () => {
    const SAM = { user: { id: '/users/sam', name: 'Sam' }, name: 'Sam', colour: '#c084fc', isSelf: false, clientIds: ['tab-sam'] }
    const options = [{ label: 'First', value: 'a' }, { label: 'Second', value: 'b' }]

    test.each([
      ['CwaUiFormInput', Input, 'Mine', {}],
      ['CwaUiFormToggle', Toggle, false, { label: 'Visible' }],
      ['CwaUiSelect', Select, 'b', { options }],
    ] as const)('%s outlines itself with the name of whoever has it focused, and only then', async (_name, component, initial, props) => {
      const model = fieldModel<any>(initial)
      const wrapper = mount(component as any, { props: { ...props, model } })
      expect(wrapper.find('[data-testid="field-presence"]').exists()).toBe(false)

      model.peers.value = [SAM]
      await nextTick()

      const presence = wrapper.get('[data-testid="field-presence"]')
      expect(presence.text()).toBe('Sam')
      expect(presence.element.parentElement!.classList).toContain('cwa:relative')
      expect(presence.element.parentElement!.classList).toContain('cwa:group/field')
    })

    test('a field with no model shows no one', () => {
      const wrapper = mount(Input, { props: { modelValue: 'Plain' } })

      expect(wrapper.find('[data-testid="field-presence"]').exists()).toBe(false)
    })
  })
})
