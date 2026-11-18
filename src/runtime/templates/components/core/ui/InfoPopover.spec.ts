// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { drawsFocusRing } from '../../../../../../test/utils/focus-ring'
import { drawsOpenState } from '../../../../../../test/utils/open-state'
import { axe } from '../../../../../../test/utils/axe'
import InfoPopover from './InfoPopover.vue'

enableAutoUnmount(afterEach)

describe('InfoPopover (#461)', () => {
  test('the info button draws its focus ring when focused from the keyboard', () => {
    const wrapper = mount(InfoPopover, { props: { label: 'Reference', text: 'Only admins see this.', textId: 'reference-info' } })

    expect(drawsFocusRing(wrapper.get('[data-testid="field-info"]').classes())).toBe(true)
  })
  test('the info button shows itself selected while its popover is open, with its hover fill and a 2px line in its text colour, and not once it closes; the focus ring stays its own', async () => {
    const wrapper = mount(InfoPopover, { props: { label: 'Reference', text: 'Only admins see this.', textId: 'reference-info' }, attachTo: document.body })
    const trigger = wrapper.get('[data-testid="field-info"]')
    expect(drawsOpenState(trigger.element)).toBe(false)

    await trigger.trigger('click')
    await flushPromises()
    expect(drawsOpenState(trigger.element)).toBe(true)
    expect(drawsFocusRing(trigger.classes())).toBe(true)
    expect(await axe(document.body, { rules: { region: { enabled: false } } })).toHaveNoViolations()

    document.querySelector<HTMLElement>('[data-testid="field-info-popover"] button[aria-label="Close"]')!.click()
    await flushPromises()
    expect(drawsOpenState(trigger.element)).toBe(false)
  })

  test('the popover\'s title row and Close sit inside its padding, never pulled into the corner with negative margins', async () => {
    const wrapper = mount(InfoPopover, { props: { label: 'Reference', text: 'Only admins see this.', textId: 'reference-info' }, attachTo: document.body })

    await wrapper.get('[data-testid="field-info"]').trigger('click')
    await flushPromises()

    const title = document.querySelector('[data-testid="field-info-popover"] [data-glyph="info"]')!.parentElement!
    expect([...title.classList].filter(name => name.startsWith('cwa:-'))).toEqual([])
  })

  test('the popover is the kit artifact\'s: the menu surface, text colour and shadow, 1rem padding at 1.5 line height, an accent ⓘ before its title and a square caret in the panel\'s fill, with a 1px line ring on the panel and on the caret\'s two outer edges so both stand out on dark surfaces (#461)', async () => {
    const wrapper = mount(InfoPopover, { props: { label: 'Reference', text: 'Only admins see this.', textId: 'reference-info' }, attachTo: document.body })

    await wrapper.get('[data-testid="field-info"]').trigger('click')
    await flushPromises()

    const popover = document.querySelector<HTMLElement>('[data-testid="field-info-popover"]')!
    expect([...popover.classList]).toEqual(expect.arrayContaining(['cwa:bg-surface-menu', 'cwa:text-fg', 'cwa:shadow-popover', 'cwa:p-popover', 'cwa:text-control', 'cwa:leading-normal']))
    expect(popover.classList).not.toContain('cwa:bg-surface-info')
    const glyph = popover.querySelector('[data-glyph="info"]')!
    expect(glyph.getAttribute('class')).toContain('cwa:text-accent-fg')
    expect(glyph.nextElementSibling?.textContent).toBe('Reference')
    const caret = [...popover.querySelectorAll('svg')].at(-1)!
    expect(caret.getAttribute('class')).toContain('cwa:fill-surface-menu')
    expect([caret.getAttribute('width'), caret.getAttribute('height')]).toEqual(['14', '7'])
    expect(popover.classList).toContain('cwa:ring-1')
    expect(popover.classList).toContain('cwa:ring-line')
    expect(caret.getAttribute('class')).toContain('cwa:stroke-line')
    const edge = caret.querySelector('path')!
    expect(edge.getAttribute('d')).toBe('M0 0L6 6L12 0')
    expect(edge.getAttribute('vector-effect')).toBe('non-scaling-stroke')
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
