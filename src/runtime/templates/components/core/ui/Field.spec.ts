// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { axe } from '../../../../../../test/utils/axe'
import { fakeFieldModel } from '../../../../../../playground/app/kit/fake-field-model'
import type { FakeStatus } from '../../../../../../playground/app/kit/fake-field-model'
import Input from '../../ui/Input.vue'

enableAutoUnmount(afterEach)

function mountInput(status: FakeStatus, extra: Record<string, unknown> = {}) {
  const model = fakeFieldModel<string>('Mine', status, 'Theirs')
  const wrapper = mount(Input, { props: { label: 'Title', model, ...extra }, attachTo: document.body })
  return { model, wrapper }
}

function line(wrapper: ReturnType<typeof mount>) {
  return wrapper.get('[data-testid="field-status-line"]').attributes('data-line')
}

async function focusField(wrapper: ReturnType<typeof mount>) {
  await flushPromises()
  wrapper.get<HTMLInputElement>('input').element.focus()
  await flushPromises()
}

function popover() {
  return document.querySelector<HTMLElement>('[data-testid="field-status-popover"]')
}

describe('Field and its status (#459)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  test.each([
    ['idle', undefined],
    ['pending', undefined],
    ['saving', 'saving'],
    ['saved', 'saved'],
    ['error', 'error'],
    ['conflict', 'conflict'],
  ] as const)('a %s field draws the edge line %s', (status, expected) => {
    const { wrapper } = mountInput(status)

    expect(line(wrapper)).toBe(expected)
  })

  test('saved shows for 1.18 s from when it was saved, then the line goes', async () => {
    vi.useFakeTimers()
    const { wrapper } = mountInput('saved')

    expect(line(wrapper)).toBe('saved')
    vi.advanceTimersByTime(1100)
    await nextTick()
    expect(line(wrapper)).toBe('saved')
    vi.advanceTimersByTime(100)
    await nextTick()
    expect(line(wrapper)).toBeUndefined()
  })

  test('a field being saved is busy, and one in error is invalid and described by what went wrong', () => {
    const saving = mountInput('saving').wrapper.get('input')
    expect(saving.attributes('aria-busy')).toBe('true')
    expect(saving.attributes('aria-invalid')).toBeUndefined()

    const failed = mountInput('error').wrapper
    const input = failed.get('input')
    expect(input.attributes('aria-invalid')).toBe('true')
    const description = document.getElementById(input.attributes('aria-describedby')!)
    expect(description?.textContent).toContain('Not saved. The connection dropped.')
  })

  test('focusing a field in error opens its popover at once, with Retry then Reset next in the tab order', async () => {
    const { wrapper } = mountInput('error')

    expect(popover()).toBeNull()
    await focusField(wrapper)

    const pop = popover()!
    expect(pop.getAttribute('aria-label')).toBe('Title: not saved')
    const tabbable = [...wrapper.element.querySelectorAll<HTMLElement>('input, button:not([tabindex="-1"])')]
    expect(tabbable.map(each => each.tagName === 'INPUT' ? 'input' : each.textContent?.trim())).toEqual(['input', 'Retry', 'Reset'])
  })

  test('Retry asks the model to send again and puts focus back in the field', async () => {
    const { model, wrapper } = mountInput('error')
    await focusField(wrapper)

    document.querySelector<HTMLElement>('[data-testid="field-status-retry"]')!.click()
    await flushPromises()

    expect(model.retried.value).toBe(1)
    expect(document.activeElement).toBe(wrapper.get('input').element)
    expect(popover()).toBeNull()
  })

  test('pressing Enter on Retry, having tabbed to it, sends again and puts focus back in the field, not on the button that goes away', async () => {
    const { model, wrapper } = mountInput('error')
    await focusField(wrapper)

    const retry = document.querySelector<HTMLElement>('[data-testid="field-status-retry"]')!
    retry.focus()
    await flushPromises()
    retry.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    retry.click()
    await flushPromises()

    expect(model.retried.value).toBe(1)
    expect(popover()).toBeNull()
    expect(document.activeElement).toBe(wrapper.get('input').element)
  })

  test('Escape from Reset, having tabbed to it, closes the popover and puts focus back in the field', async () => {
    const { wrapper } = mountInput('error')
    await focusField(wrapper)

    const reset = document.querySelector<HTMLElement>('[data-testid="field-status-reset"]')!
    reset.focus()
    await flushPromises()
    reset.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()

    expect(popover()).toBeNull()
    expect(document.activeElement).toBe(wrapper.get('input').element)
  })

  test('Reset puts the last saved value back', async () => {
    const { model, wrapper } = mountInput('error')
    model.model.value = 'Typed'
    await focusField(wrapper)

    document.querySelector<HTMLElement>('[data-testid="field-status-reset"]')!.click()
    await flushPromises()

    expect(model.model.value).toBe('Mine')
    expect(model.status.value).toBe('idle')
  })

  test('a conflict shows both values and takes theirs on Use theirs', async () => {
    const { model, wrapper } = mountInput('conflict')
    await focusField(wrapper)

    expect(popover()!.textContent).toContain('Alex changed this while you were editing.')
    expect(popover()!.textContent).toContain('Theirs')
    expect(popover()!.textContent).toContain('Mine')
    document.querySelector<HTMLElement>('[data-testid="field-status-theirs"]')!.click()
    await flushPromises()

    expect(model.model.value).toBe('Theirs')
  })

  test('hovering opens the popover only after 300 ms, so passing over a field does not', async () => {
    vi.useFakeTimers()
    const { wrapper } = mountInput('error')
    await nextTick()
    const box = wrapper.get('input').element.closest('.cwa\\:relative:not(.cwa\\:group\\/field)')!

    box.dispatchEvent(new MouseEvent('mouseenter'))
    vi.advanceTimersByTime(250)
    await nextTick()
    expect(popover()).toBeNull()
    vi.advanceTimersByTime(60)
    await nextTick()
    await nextTick()
    expect(popover()).not.toBeNull()
  })

  test('info is a named ⓘ whose text also describes the control', () => {
    const { wrapper } = mountInput('idle', { info: 'Shown as the page heading.' })

    expect(wrapper.get('[data-testid="field-info"]').attributes('aria-label')).toBe('About Title')
    const described = wrapper.get('input').attributes('aria-describedby')!
    expect(document.getElementById(described)?.textContent).toBe('Shown as the page heading.')
  })

  test.each(['idle', 'saving', 'saved', 'error', 'conflict'] as const)('a %s field has no axe violations', async (status) => {
    const { wrapper } = mountInput(status, { info: 'Shown as the page heading.' })
    await focusField(wrapper)

    expect(await axe(document.body)).toHaveNoViolations()
  })
})
