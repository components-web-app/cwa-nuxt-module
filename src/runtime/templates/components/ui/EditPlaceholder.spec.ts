// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { h } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { axe } from '../../../../../test/utils/axe'
import { failingInk, shownColour, shownFill } from '../../../../../test/utils/kit-css'
import EditPlaceholder from './EditPlaceholder.vue'

enableAutoUnmount(afterEach)

const message = 'Visitors see nothing here until a component is added.'

function mountPlaceholder(props: Record<string, unknown> = {}, onClick = () => {}) {
  return mount(EditPlaceholder, {
    props: { label: 'Empty group', info: message, ...props },
    slots: { default: ({ describedBy }: { describedBy?: string }) => h('button', { 'type': 'button', 'aria-describedby': describedBy, 'data-testid': 'plus', onClick }, [h('span', { class: 'cwa:sr-only' }, 'Add component position')]) },
    attachTo: document.body,
  })
}

function tooltip() {
  return document.body.querySelector('[data-testid="edit-placeholder-tooltip"]')
}

describe('CwaUiEditPlaceholder (#461)', () => {
  function visibleText(element: Element) {
    const visible = element.cloneNode(true) as HTMLElement
    visible.querySelectorAll('.cwa\\:sr-only').forEach(hidden => hidden.remove())
    return visible.textContent
  }

  test('keeps its box in muted text on the admin surface, with a solid line, so it reads on any site', () => {
    const wrapper = mount(EditPlaceholder, { props: { label: 'Add an image' } })

    expect(wrapper.attributes('data-testid')).toBe('edit-placeholder')
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['cwa:min-h-16', 'cwa:border', 'cwa:border-line', 'cwa:bg-surface', 'cwa:text-fg-muted']))
    expect(wrapper.classes().join(' ')).not.toMatch(/rounded|dashed|dotted|line-dash/)
  })

  test('shows no text of its own: the label and the explanation are for screen readers only, and only what the caller adds shows', () => {
    const wrapper = mountPlaceholder()

    expect(wrapper.text()).toContain('Empty group')
    expect(wrapper.text()).toContain(message)
    expect(visibleText(wrapper.element)).toBe('')
    expect(wrapper.find('[data-testid="field-info"]').exists()).toBe(false)
  })

  test('the label names the placeholder and the explanation describes it', () => {
    const wrapper = mountPlaceholder()

    expect(wrapper.attributes('role')).toBe('group')
    expect(document.getElementById(wrapper.attributes('aria-labelledby')!)!.textContent).toBe('Empty group')
    expect(document.getElementById(wrapper.attributes('aria-describedby')!)!.textContent).toBe(message)
  })

  test('with no explanation it shows nothing, is still named, and has no description', () => {
    const wrapper = mount(EditPlaceholder, { props: { label: 'Add an image' } })

    expect(visibleText(wrapper.element)).toBe('')
    expect(wrapper.get(`[id="${wrapper.attributes('aria-labelledby')}"]`).text()).toBe('Add an image')
    expect(wrapper.attributes('aria-describedby')).toBeUndefined()
  })

  test('the + keeps the action as its name and is described by the explanation', () => {
    const wrapper = mountPlaceholder()
    const plus = wrapper.get('[data-testid="plus"]')

    expect(plus.text()).toBe('Add component position')
    expect(document.getElementById(plus.attributes('aria-describedby')!)!.textContent).toBe(message)
  })

  test('hovering the + shows the explanation as a tooltip, and leaving it hides it', async () => {
    const wrapper = mountPlaceholder()
    const cue = wrapper.get('[data-testid="edit-placeholder-cue"]')
    expect(tooltip()).toBeNull()

    await cue.trigger('pointerenter', { pointerType: 'mouse' })
    await flushPromises()
    expect(tooltip()?.textContent).toContain(message)
    expect(document.activeElement).toBe(document.body)

    await cue.trigger('pointerleave', { pointerType: 'mouse' })
    await new Promise(resolve => setTimeout(resolve, 250))
    await flushPromises()
    expect(tooltip()).toBeNull()
  })

  test('the tooltip is the dark info panel, its white text passing on it in both themes (#461)', async () => {
    const wrapper = mountPlaceholder()
    await wrapper.get('[data-testid="edit-placeholder-cue"]').trigger('pointerenter', { pointerType: 'mouse' })
    await flushPromises()

    expect(shownFill(tooltip()!)).toBe('surface-info')
    expect(shownColour(tooltip()!.querySelector('p')!)).toBe('white')
    expect(failingInk(tooltip()!)).toEqual([])
  })

  test('focusing the + shows the explanation and keeps focus on it; Escape and blur hide it', async () => {
    const wrapper = mountPlaceholder()
    const plus = wrapper.get<HTMLButtonElement>('[data-testid="plus"]')

    plus.element.focus()
    await flushPromises()
    expect(tooltip()?.textContent).toContain(message)
    expect(document.activeElement).toBe(plus.element)

    await plus.trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(tooltip()).toBeNull()

    plus.element.blur()
    plus.element.focus()
    await flushPromises()
    expect(tooltip()).not.toBeNull()
    plus.element.blur()
    await flushPromises()
    expect(tooltip()).toBeNull()
  })

  test('a tap on the + adds and opens no tooltip', async () => {
    const onClick = vi.fn()
    const wrapper = mountPlaceholder({}, onClick)
    const cue = wrapper.get('[data-testid="edit-placeholder-cue"]')

    await cue.trigger('pointerenter', { pointerType: 'touch' })
    await wrapper.get('[data-testid="plus"]').trigger('click')
    await flushPromises()

    expect(onClick).toHaveBeenCalledOnce()
    expect(tooltip()).toBeNull()
  })

  test('with no explanation nothing opens', async () => {
    const wrapper = mountPlaceholder({ info: undefined })

    await wrapper.get('[data-testid="edit-placeholder-cue"]').trigger('pointerenter', { pointerType: 'mouse' })
    await flushPromises()
    expect(tooltip()).toBeNull()
    expect(wrapper.get('[data-testid="plus"]').attributes('aria-describedby')).toBeUndefined()
  })

  test('has no axe violations, open or closed', async () => {
    const wrapper = mountPlaceholder()
    expect(await axe(document.body)).toHaveNoViolations()

    await wrapper.get('[data-testid="edit-placeholder-cue"]').trigger('pointerenter', { pointerType: 'mouse' })
    await flushPromises()
    expect(tooltip()).not.toBeNull()
    expect(await axe(document.body)).toHaveNoViolations()
  })
})
