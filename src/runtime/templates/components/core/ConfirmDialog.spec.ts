// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ConfirmDialog from './ConfirmDialog.vue'

const DialogBoxStub = {
  name: 'DialogBox',
  props: ['modelValue', 'title', 'buttons'],
  emits: ['update:modelValue'],
  template: '<div class="dialog-box-stub"><slot /></div>',
}

function mountDialog(notice?: string) {
  return mount(ConfirmDialog, {
    props: { title: 'Are you sure?', content: '<p>Sure?</p>', notice },
    global: { stubs: { DialogBox: DialogBoxStub } },
  })
}

describe('ConfirmDialog', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  test.each(['Ok', 'Cancel'])('the %s button emits its answer once', async (label) => {
    vi.useFakeTimers()
    const wrapper = mountDialog()
    const button = wrapper.findComponent({ name: 'DialogBox' }).props('buttons').find((b: { label: string }) => b.label === label)

    button.callbackFn()
    await wrapper.vm.$nextTick()
    vi.runAllTimers()

    expect(wrapper.emitted()).toEqual(expect.objectContaining(label === 'Ok' ? { confirm: [[]] } : { cancel: [[]] }))
    expect(wrapper.emitted(label === 'Ok' ? 'cancel' : 'confirm')).toBeUndefined()
  })

  test('closing the dialog with Escape or the backdrop answers cancel, so the caller\'s reveal() settles', async () => {
    vi.useFakeTimers()
    const wrapper = mountDialog()

    await wrapper.findComponent({ name: 'DialogBox' }).vm.$emit('update:modelValue', false)
    vi.runAllTimers()

    expect(wrapper.emitted('cancel')).toEqual([[]])
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  test('says who else is editing the resource, as text, after the question (#429)', () => {
    const wrapper = mountDialog('<b>Sam</b> is editing this.')

    const notice = wrapper.get('[data-testid="confirm-notice"]')
    expect(notice.text()).toBe('<b>Sam</b> is editing this.')
    expect(notice.element.previousElementSibling?.innerHTML).toBe('<p>Sure?</p>')
  })

  test('has no notice when nobody else is editing', () => {
    expect(mountDialog().find('[data-testid="confirm-notice"]').exists()).toBe(false)
  })
})
