import { describe, expect, test } from 'vitest'
import { buttonLooks, openTriggerMark } from './kit-looks'

describe('kit looks: a trigger whose popover or menu is open (#461)', () => {
  test.each(Object.entries(buttonLooks).flatMap(([variant, tones]) => Object.entries(tones).map(([tone, look]) => [`${variant} ${tone}`, look] as const)))('a %s button looks hovered while open', (_name, look) => {
    expect(look.open).toBe(look.hover.replaceAll('cwa:hover:', 'cwa:aria-expanded:'))
  })

  test('the open mark is a 2px line in the trigger\'s own text colour, which already meets contrast on the fill, set from aria-expanded and never an outline, which is the focus ring\'s', () => {
    expect(openTriggerMark).toBe('cwa:aria-expanded:shadow-[inset_0_-2px_0_currentColor]')
  })
})
