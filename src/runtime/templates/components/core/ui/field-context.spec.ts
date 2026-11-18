// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { consola } from 'consola'
import { fakeFieldModel } from '../../../../../../playground/app/kit/fake-field-model'
import Input from '../../ui/Input.vue'
import { createAnnouncer } from './field-context'

vi.mock('#cwa/composables/cwa-resource-model', () => ({ useCwaResourceModel: vi.fn() }))

enableAutoUnmount(afterEach)

describe('kit field binding (#459)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  test('two bindings at once are an error in development', () => {
    const error = vi.spyOn(consola, 'error').mockImplementation(() => {})
    mount(Input, { props: { label: 'Title', model: fakeFieldModel('x'), modelValue: 'y' } })

    expect(error).toHaveBeenCalledWith('A kit control takes exactly one of `field`, `:model` or `v-model`, but was given `model` and `modelValue`.')
  })

  test('field="…" outside a tab is an error and leaves the control disabled', () => {
    const error = vi.spyOn(consola, 'error').mockImplementation(() => {})
    const wrapper = mount(Input, { props: { label: 'Title', field: 'title' } })

    expect(error).toHaveBeenCalledWith('`field="title"` needs a CwaUiManagerTab, CwaUiDialog or CwaUiFormGroup')
    expect(wrapper.get('input').attributes('disabled')).toBeDefined()
  })

  test('the announcer clears and then sets its message, so the same words are voiced twice', () => {
    vi.useFakeTimers()
    const { message, announce } = createAnnouncer()

    announce('Saved')
    vi.advanceTimersByTime(100)
    expect(message.value).toBe('Saved')
    announce('Saved')
    expect(message.value).toBe('')
    vi.advanceTimersByTime(100)
    expect(message.value).toBe('Saved')
  })
})
