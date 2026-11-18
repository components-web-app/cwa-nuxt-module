// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { drawsFocusRing } from '../../../../../../test/utils/focus-ring'
import InfoPopover from './InfoPopover.vue'

enableAutoUnmount(afterEach)

describe('InfoPopover (#461)', () => {
  test('the info button draws its focus ring when focused from the keyboard', () => {
    const wrapper = mount(InfoPopover, { props: { label: 'Reference', text: 'Only admins see this.', textId: 'reference-info' } })

    expect(drawsFocusRing(wrapper.get('[data-testid="field-info"]').classes())).toBe(true)
  })

  function mountHover() {
    const wrapper = mount(InfoPopover, { props: { label: 'Reference', text: 'Only admins see this.', textId: 'reference-info', hover: true }, attachTo: document.body })
    return { wrapper, trigger: wrapper.get<HTMLButtonElement>('[data-testid="field-info"]') }
  }

  const popover = () => document.querySelector('[data-testid="field-info-popover"]')
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  test('a click on a hover-opened popover keeps it open, and then leaving no longer hides it', async () => {
    const { trigger } = mountHover()
    await trigger.trigger('pointerenter', { pointerType: 'mouse' })
    await flushPromises()
    expect(popover()).not.toBeNull()

    await trigger.trigger('click')
    await flushPromises()
    expect(popover()).not.toBeNull()

    await trigger.trigger('pointerleave', { pointerType: 'mouse' })
    await wait(250)
    await flushPromises()
    expect(popover()).not.toBeNull()

    await trigger.trigger('click')
    await flushPromises()
    expect(popover()).toBeNull()
  })

  test('after a keyboard open, one Escape closes it, focus stays on the button and it does not reopen', async () => {
    const { trigger } = mountHover()
    trigger.element.focus()
    await trigger.trigger('focus')
    await flushPromises()
    expect(popover()).not.toBeNull()

    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    await trigger.trigger('focus')
    await wait(20)
    await flushPromises()

    expect(popover()).toBeNull()
    expect(document.activeElement).toBe(trigger.element)
  })

  test('a later keyboard focus, after it was closed and focus left, opens it again', async () => {
    const { trigger } = mountHover()
    trigger.element.focus()
    await trigger.trigger('focus')
    await flushPromises()
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    await wait(20)
    trigger.element.blur()
    await trigger.trigger('blur')
    await wait(200)

    trigger.element.focus()
    await trigger.trigger('focus')
    await flushPromises()
    expect(popover()).not.toBeNull()
  })
})
