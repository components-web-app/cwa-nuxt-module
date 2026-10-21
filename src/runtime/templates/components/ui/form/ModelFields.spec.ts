// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, nextTick, ref, shallowRef } from 'vue'
import type { RemoteFieldChange } from '#cwa/resources/model-editors'
import Input from './Input.vue'
import Toggle from './Toggle.vue'
import Select from '../Select.vue'

vi.mock('#cwa/composables/popper', () => ({
  usePopper: vi.fn(() => [ref(null), ref(null)]),
}))

function fieldModel<T>(initial: T) {
  const value = ref<T | null | undefined>(initial)
  const change = shallowRef<RemoteFieldChange<T>>()
  return {
    model: computed({ get: () => value.value, set: (next) => {
      value.value = next
    } }),
    remoteChange: computed(() => change.value),
    focus: vi.fn(),
    blur: vi.fn(),
    value,
    change,
  }
}

function conflict<T>(value: T, name?: string) {
  return { value, user: name ? { id: '/_/users/2', name } : { id: '/_/users/2' }, accept: vi.fn(), keep: vi.fn() }
}

describe('kit fields bound to a resource model (#429)', () => {
  test('CwaUiFormInput shows and writes the model, and reports focus and blur to it', async () => {
    const model = fieldModel('Mine')
    const wrapper = mount(Input, { props: { model } })
    const input = wrapper.get('input')

    expect(input.element.value).toBe('Mine')
    await input.setValue('Edited')
    expect(model.value.value).toBe('Edited')

    await input.trigger('focus')
    expect(model.focus).toHaveBeenCalledOnce()
    await input.trigger('blur')
    expect(model.blur).toHaveBeenCalledOnce()
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

  test('a conflict from someone with no known name says Someone', async () => {
    const model = fieldModel('Mine')
    model.change.value = conflict('Theirs')
    const wrapper = mount(Input, { props: { model } })

    expect(wrapper.get('[data-testid="remote-change"]').text()).toContain('Someone changed this')
  })

  test('CwaUiFormToggle writes the model, reports focus and shows a conflict', async () => {
    const model = fieldModel<boolean>(false)
    model.change.value = conflict(true, 'Sam')
    const wrapper = mount(Toggle, { props: { label: 'Visible', model } })

    await wrapper.get('button').trigger('click')
    expect(model.value.value).toBe(true)
    await wrapper.get('button').trigger('focus')
    expect(model.focus).toHaveBeenCalledOnce()
    await wrapper.get('button').trigger('blur')
    expect(model.blur).toHaveBeenCalledOnce()
    expect(wrapper.get('[data-testid="remote-change"]').text()).toContain('Sam changed this')
  })

  test('CwaUiSelect shows the model\'s option, reports focus and shows a conflict', async () => {
    const model = fieldModel('b')
    model.change.value = conflict('a', 'Sam')
    const wrapper = mount(Select, { props: { model, options: [{ label: 'First', value: 'a' }, { label: 'Second', value: 'b' }] } })

    const trigger = wrapper.get('button')
    expect(trigger.text()).toContain('Second')
    await trigger.trigger('focus')
    expect(model.focus).toHaveBeenCalledOnce()
    await trigger.trigger('blur')
    expect(model.blur).toHaveBeenCalledOnce()
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
})
