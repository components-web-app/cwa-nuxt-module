import { describe, expect, test } from 'vitest'
import { buttonLookColours, buttonLooks, openTriggerMark } from './kit-looks'

describe('kit looks: a trigger whose popover or menu is open (#461)', () => {
  test.each(['soft', 'ghost'] as const)('a %s button looks hovered while open', (variant) => {
    for (const look of Object.values(buttonLooks[variant])) {
      expect(look.open).toBe(look.hover.replaceAll('cwa:hover:', 'cwa:aria-expanded:'))
    }
  })

  test.each([['accent', 'accent-open'], ['danger', 'danger-fill-open']] as const)('a solid %s button takes a darker fill of its own while open, clearly apart from its rest and hover fills, with its text unchanged', (tone, fill) => {
    expect(buttonLooks.solid[tone].open).toBe(`cwa:aria-expanded:bg-${fill}`)
    const colours = buttonLookColours('solid', tone)
    expect(colours.open).toEqual({ fg: colours.rest.fg, bg: fill })
    expect(colours.open.bg).not.toBe(colours.rest.bg)
    expect(colours.open.bg).not.toBe(colours.hover.bg)
  })

  test('a look\'s open state is a fill, never a line: the line is openTriggerMark, a 2px line in the trigger\'s own text colour from aria-expanded, never an outline, which is the focus ring\'s, and only a trigger with a text label adds it', () => {
    expect(JSON.stringify(buttonLooks)).not.toContain('shadow')
    expect(openTriggerMark).toBe('cwa:aria-expanded:shadow-[inset_0_-2px_0_currentColor]')
  })
})
