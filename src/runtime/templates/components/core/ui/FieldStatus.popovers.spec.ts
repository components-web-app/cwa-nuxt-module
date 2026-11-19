// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { axe } from '../../../../../../test/utils/axe'
import { fakeFieldModel } from '../../../../../../playground/app/kit/fake-field-model'
import type { FakeStatus } from '../../../../../../playground/app/kit/fake-field-model'
import Input from '../../ui/Input.vue'

enableAutoUnmount(afterEach)

function mountPair(a: FakeStatus = 'error', b: FakeStatus = 'conflict') {
  const first = fakeFieldModel<string>('Mine', a, 'Theirs')
  const second = fakeFieldModel<string>('Mine', b, 'Theirs')
  const wrapper = mount(defineComponent({
    setup: () => () => h('div', [
      h(Input, { label: 'Title', model: first }),
      h(Input, { label: 'Summary', model: second }),
    ]),
  }), { attachTo: document.body })
  const inputs = wrapper.findAll<HTMLInputElement>('input').map(each => each.element)
  const boxes = inputs.map(each => each.closest<HTMLElement>('.cwa\\:relative:not(.cwa\\:group\\/field)')!)
  return { wrapper, inputs, boxes }
}

function shown() {
  return [...document.querySelectorAll<HTMLElement>('[data-testid="field-status-popover"]')].map(each => each.getAttribute('aria-label'))
}

async function settle(ms = 0) {
  await vi.advanceTimersByTimeAsync(ms)
}

async function hover(box: HTMLElement) {
  box.dispatchEvent(new MouseEvent('mouseenter'))
  await settle(310)
}

async function leave(box: HTMLElement) {
  box.dispatchEvent(new MouseEvent('mouseleave'))
  await settle(310)
}

function closeButton() {
  return document.querySelector<HTMLElement>('[data-testid="field-status-popover"] [aria-label="Close"]')!
}

async function clickClose() {
  const close = closeButton()
  const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
  close.dispatchEvent(press)
  press.defaultPrevented || close.focus()
  close.click()
  await settle(10)
}

describe('one field status popover at a time, and its Close (#461)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  test('hovering a second field in conflict while the first, in error, is hovered open shows only the second\'s popover', async () => {
    const { boxes } = mountPair()
    await settle()

    await hover(boxes[0]!)
    expect(shown()).toEqual(['Title: not saved'])
    boxes[0]!.dispatchEvent(new MouseEvent('mouseleave'))
    await hover(boxes[1]!)

    expect(shown()).toEqual(['Summary: changed by Alex'])
  })

  test('hovering another field while one is open from its focus shows only the hovered one, and the focused one comes back when the pointer leaves', async () => {
    const { inputs, boxes } = mountPair('error', 'error')
    await settle()
    inputs[0]!.focus()
    await settle()
    expect(shown()).toEqual(['Title: not saved'])

    await hover(boxes[1]!)
    expect(shown()).toEqual(['Summary: not saved'])

    await leave(boxes[1]!)
    expect(shown()).toEqual(['Title: not saved'])
  })

  test('clicking into another field in error closes the first\'s popover and opens its own', async () => {
    const { inputs } = mountPair('error', 'error')
    await settle()
    inputs[0]!.focus()
    await settle()

    inputs[1]!.focus()
    await settle()

    expect(shown()).toEqual(['Summary: not saved'])
  })

  test('Close on a popover opened by focus closes it, leaves focus in the field and does not reopen it, until focus leaves and comes back', async () => {
    const { inputs } = mountPair()
    await settle()
    inputs[0]!.focus()
    await settle()

    await clickClose()
    await settle(400)

    expect(shown()).toEqual([])
    expect(document.activeElement).toBe(inputs[0])

    inputs[0]!.blur()
    await settle()
    inputs[0]!.focus()
    await settle()
    expect(shown()).toEqual(['Title: not saved'])
  })

  test('after Close, a new failure while focus stays in the field opens the popover again', async () => {
    const first = fakeFieldModel<string>('Mine', 'error')
    const wrapper = mount(Input, { props: { label: 'Title', model: first }, attachTo: document.body })
    await settle()
    wrapper.get('input').element.focus()
    await settle()
    await clickClose()
    expect(shown()).toEqual([])

    first.status.value = 'saving'
    await settle()
    first.status.value = 'error'
    await settle()

    expect(shown()).toEqual(['Title: not saved'])
  })

  test('Close on a popover opened by hover keeps it closed while the pointer stays, and it opens again once the pointer leaves and comes back', async () => {
    const { boxes } = mountPair()
    await settle()
    await hover(boxes[1]!)
    const popover = document.querySelector<HTMLElement>('[data-testid="field-status-popover"]')!
    popover.dispatchEvent(new MouseEvent('mouseenter'))

    await clickClose()
    popover.dispatchEvent(new MouseEvent('mouseenter'))
    boxes[1]!.dispatchEvent(new MouseEvent('mouseenter'))
    await settle(400)
    expect(shown()).toEqual([])
    expect(document.activeElement).toBe(document.body)

    await leave(boxes[1]!)
    await hover(boxes[1]!)
    expect(shown()).toEqual(['Summary: changed by Alex'])
  })

  test('Escape closes the open popover, and it does not reopen while focus stays in the field and the pointer that clicked into it stays over it', async () => {
    const { inputs, boxes } = mountPair()
    await settle()
    boxes[0]!.dispatchEvent(new MouseEvent('mouseenter'))
    inputs[0]!.focus()
    await settle()

    inputs[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle(400)

    expect(shown()).toEqual([])
    expect(document.activeElement).toBe(inputs[0])
  })

  test('Escape from Retry, having tabbed to it, closes the popover with focus back in the field, and it stays closed', async () => {
    const { inputs } = mountPair()
    await settle()
    inputs[0]!.focus()
    await settle()
    const retry = document.querySelector<HTMLElement>('[data-testid="field-status-retry"]')!
    retry.focus()
    await settle()

    retry.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle(400)

    expect(shown()).toEqual([])
    expect(document.activeElement).toBe(inputs[0])
  })

  test('two fields with popovers have no axe violations with one open', async () => {
    const { inputs } = mountPair()
    await settle()
    inputs[0]!.focus()
    await settle()

    vi.useRealTimers()
    expect(await axe(document.body)).toHaveNoViolations()
  })
})
