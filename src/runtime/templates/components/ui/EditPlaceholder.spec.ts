// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { h } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { axe } from '../../../../../test/utils/axe'
import EditPlaceholder from './EditPlaceholder.vue'

enableAutoUnmount(afterEach)

const message = 'Visitors see nothing here until a component is added.'

function mountPlaceholder(props: Record<string, unknown> = {}) {
  return mount(EditPlaceholder, { props: { label: 'Empty group', info: message, ...props }, slots: { default: () => h('button', { type: 'button' }, 'Add') }, attachTo: document.body })
}

function popover() {
  return document.body.querySelector('[data-testid="field-info-popover"]')
}

describe('CwaUiEditPlaceholder (#461)', () => {
  test('shows its short label and what the caller adds in muted text on the admin surface, with a solid line, so it reads on any site', () => {
    const wrapper = mount(EditPlaceholder, { props: { label: 'Add an image' } })

    expect(wrapper.text()).toBe('Add an image')
    expect(wrapper.attributes('data-testid')).toBe('edit-placeholder')
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['cwa:border', 'cwa:border-line', 'cwa:bg-surface', 'cwa:text-fg-muted']))
    expect(wrapper.classes().join(' ')).not.toMatch(/rounded|dashed|dotted|line-dash/)
  })

  test('the message is never shown inline: only the label, the action and an info button', () => {
    const wrapper = mountPlaceholder()

    expect(wrapper.findAll('button').map(button => button.text())).toContain('Add')
    expect(wrapper.get('[data-testid="field-info"]').exists()).toBe(true)
    const visible = wrapper.element.cloneNode(true) as HTMLElement
    visible.querySelectorAll('.cwa\\:sr-only').forEach(hidden => hidden.remove())
    expect(visible.textContent).toBe('Empty groupAdd')
    expect(popover()).toBeNull()
  })

  test('the message is the info button\'s accessible description', () => {
    const wrapper = mountPlaceholder()
    const info = wrapper.get('[data-testid="field-info"]')

    expect(document.getElementById(info.attributes('aria-describedby')!)!.textContent).toBe(message)
  })

  test('hovering the info button shows the message, and leaving it hides it', async () => {
    const wrapper = mountPlaceholder()
    const info = wrapper.get('[data-testid="field-info"]')

    await info.trigger('pointerenter', { pointerType: 'mouse' })
    await flushPromises()
    expect(popover()?.textContent).toContain(message)
    expect(document.activeElement).not.toBe(popover())

    await info.trigger('pointerleave', { pointerType: 'mouse' })
    await new Promise(resolve => setTimeout(resolve, 250))
    await flushPromises()
    expect(popover()).toBeNull()
  })

  test('focusing the info button from the keyboard shows the message and keeps focus on the button', async () => {
    const wrapper = mountPlaceholder()
    const info = wrapper.get<HTMLButtonElement>('[data-testid="field-info"]')

    info.element.focus()
    await info.trigger('focus')
    await flushPromises()

    expect(popover()?.textContent).toContain(message)
    expect(document.activeElement).toBe(info.element)
  })

  test('a tap opens it', async () => {
    const wrapper = mountPlaceholder()

    await wrapper.get('[data-testid="field-info"]').trigger('click')
    await flushPromises()
    expect(popover()?.textContent).toContain(message)
  })

  test('with no message there is no info button', () => {
    const wrapper = mount(EditPlaceholder, { props: { label: 'Add an image' } })

    expect(wrapper.find('[data-testid="field-info"]').exists()).toBe(false)
  })

  test('has no axe violations', async () => {
    mountPlaceholder()

    expect(await axe(document.body)).toHaveNoViolations()
  })
})
