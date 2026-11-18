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
  test('the popover is the kit artifact\'s: the menu surface, text colour and shadow, 1rem padding at 1.5 line height, an accent ⓘ before its title and a square caret in the panel\'s fill (#461)', async () => {
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
  })
})
