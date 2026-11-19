// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { drawsFocusRing } from '../../../../../../test/utils/focus-ring'
import { drawsOpenLine, drawsOpenState, failingInk, fillsOnHover, shownColour, shownFill, trimsToLetters } from '../../../../../../test/utils/kit-css'
import { axe } from '../../../../../../test/utils/axe'
import InfoPopover from './InfoPopover.vue'

enableAutoUnmount(afterEach)

describe('InfoPopover (#461)', () => {
  test('the info button draws its focus ring when focused from the keyboard', () => {
    const wrapper = mount(InfoPopover, { props: { label: 'Reference', text: 'Only admins see this.', textId: 'reference-info' } })

    expect(drawsFocusRing(wrapper.get('[data-testid="field-info"]').classes())).toBe(true)
  })
  test('the info button shows its popover open by turning its glyph the accent blue, set from aria-expanded, with no fill behind it and no line under it, and goes back to muted once it closes; hovering changes only the glyph\'s colour, and the focus ring stays its own', async () => {
    const wrapper = mount(InfoPopover, { props: { label: 'Reference', text: 'Only admins see this.', textId: 'reference-info' }, attachTo: document.body })
    const trigger = wrapper.get('[data-testid="field-info"]')
    const glyph = trigger.get('svg').element
    expect(drawsOpenState(trigger.element)).toBe(false)
    expect(shownColour(glyph)).toBe('fg-muted')
    expect(fillsOnHover(trigger.element)).toBe(false)
    expect(trigger.classes()).toContain('cwa:hover:text-fg')

    await trigger.trigger('click')
    await flushPromises()
    expect(drawsOpenState(trigger.element)).toBe(true)
    expect(drawsOpenLine(trigger.element)).toBe(false)
    expect(shownColour(glyph)).toBe('accent-fg')
    expect(shownFill(trigger.element)).toBeUndefined()
    expect(drawsFocusRing(trigger.classes())).toBe(true)
    expect(await axe(document.body, { rules: { region: { enabled: false } } })).toHaveNoViolations()

    document.querySelector<HTMLElement>('[data-testid="field-info-popover"] button[aria-label="Close"]')!.click()
    await flushPromises()
    expect(drawsOpenState(trigger.element)).toBe(false)
    expect(shownColour(glyph)).toBe('fg-muted')
  })

  test('the open popover takes the shared opening motion, with the side reka placed it on, so it rises away from its ⓘ (#461)', async () => {
    const wrapper = mount(InfoPopover, { props: { label: 'Reference', text: 'Only admins see this.', textId: 'reference-info' }, attachTo: document.body })

    await wrapper.get('[data-testid="field-info"]').trigger('click')
    await flushPromises()

    const popover = document.querySelector<HTMLElement>('[data-testid="field-info-popover"]')!
    expect(popover.classList).toContain('cwa:pop-in')
    expect(popover.dataset.state).toBe('open')
    expect(popover.dataset.side).toBe('top')
  })

  test('the popover\'s title row and Close sit inside its padding, never pulled into the corner with negative margins, the row only as tall as its letters and the text trimmed to its capitals and baseline, so the space above the title matches the space below the last line', async () => {
    const wrapper = mount(InfoPopover, { props: { label: 'Reference', text: 'Only admins see this.', textId: 'reference-info' }, attachTo: document.body })

    await wrapper.get('[data-testid="field-info"]').trigger('click')
    await flushPromises()

    const popover = document.querySelector('[data-testid="field-info-popover"]')!
    const title = popover.querySelector('[data-glyph="info"]')!.parentElement!
    expect([...title.classList].filter(name => name.startsWith('cwa:-'))).toEqual([])
    expect(title.classList).toContain('cwa:h-[1cap]')
    expect(title.classList).not.toContain('cwa:min-h-8')
    expect(trimsToLetters(title.querySelector('span')!)).toBe(true)
    expect(trimsToLetters(popover.querySelector('p')!)).toBe(true)
  })

  test('the popover is the dark information panel in both themes, white text with a white ring at 15% on it and its caret, the shadow, 1rem padding at 1.5 line height, and a blue ⓘ and title, never the menu surface the fields sit beside (#461)', async () => {
    const wrapper = mount(InfoPopover, { props: { label: 'Reference', text: 'Only admins see this.', textId: 'reference-info' }, attachTo: document.body })

    await wrapper.get('[data-testid="field-info"]').trigger('click')
    await flushPromises()

    const popover = document.querySelector<HTMLElement>('[data-testid="field-info-popover"]')!
    expect([...popover.classList]).toEqual(expect.arrayContaining(['cwa:bg-surface-info', 'cwa:text-white', 'cwa:shadow-popover', 'cwa:p-popover', 'cwa:text-control', 'cwa:leading-normal', 'cwa:ring-1', 'cwa:ring-white/15']))
    expect(popover.classList).not.toContain('cwa:bg-surface-menu')
    expect(shownFill(popover)).toBe('surface-info')
    const glyph = popover.querySelector('[data-glyph="info"]')!
    const title = glyph.nextElementSibling!
    expect(title.textContent).toBe('Reference')
    expect(shownColour(glyph)).toBe('accent-on-info')
    expect(shownColour(title)).toBe('accent-on-info')
    expect(shownColour(popover.querySelector('p')!)).toBe('white')
    expect(shownColour(popover.querySelector('button[aria-label="Close"] svg')!)).toBe('white')
    expect(failingInk(popover)).toEqual([])
    const caret = [...popover.querySelectorAll('svg')].at(-1)!
    expect(caret.getAttribute('class')).toContain('cwa:fill-surface-info')
    expect([caret.getAttribute('width'), caret.getAttribute('height')]).toEqual(['14', '7'])
    expect(caret.getAttribute('class')).toContain('cwa:stroke-white/15')
    expect(await axe(document.body, { rules: { region: { enabled: false } } })).toHaveNoViolations()
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

  test('Close on a clicked-open popover closes it with focus back on the ⓘ, and it stays closed', async () => {
    const wrapper = mount(InfoPopover, { props: { label: 'Reference', text: 'Only admins see this.', textId: 'reference-info' }, attachTo: document.body })
    const trigger = wrapper.get<HTMLButtonElement>('[data-testid="field-info"]')
    trigger.element.focus()
    await trigger.trigger('click')
    await flushPromises()
    expect(popover()).not.toBeNull()

    popover()!.querySelector<HTMLElement>('[aria-label="Close"]')!.click()
    await wait(20)
    await flushPromises()

    expect(popover()).toBeNull()
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger.element)
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
