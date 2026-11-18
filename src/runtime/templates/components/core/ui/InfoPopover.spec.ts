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
  test('the popover is a dark information surface with white text and a matching caret, never the menu surface the fields sit beside', async () => {
    const wrapper = mount(InfoPopover, { props: { label: 'Reference', text: 'Only admins see this.', textId: 'reference-info' }, attachTo: document.body })

    await wrapper.get('[data-testid="field-info"]').trigger('click')
    await flushPromises()

    const popover = document.querySelector<HTMLElement>('[data-testid="field-info-popover"]')!
    expect([...popover.classList]).toEqual(expect.arrayContaining(['cwa:bg-surface-info', 'cwa:text-white']))
    expect(popover.classList).not.toContain('cwa:bg-surface-menu')
    expect([...popover.querySelectorAll('svg')].at(-1)?.getAttribute('class')).toContain('cwa:fill-surface-info')
  })
})
