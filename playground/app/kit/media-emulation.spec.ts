import { describe, expect, test, vi } from 'vitest'
import { createMediaEmulator, emulatedMatchMedia, overrideMediaText } from './media-emulation'

const off = { coarse: false, reducedMotion: false }
const touch = { coarse: true, reducedMotion: false }
const still = { coarse: false, reducedMotion: true }

function sheet(...texts: string[]) {
  return { cssRules: texts.map(mediaText => ({ media: { mediaText }, cssRules: [] })) }
}

describe('touch and reduced-motion emulation for /kit', () => {
  test('touch mode turns the kit\'s pointer-coarse sizes on and its hover-only styles off', () => {
    expect(overrideMediaText('(pointer: coarse)', touch)).toBe('(width >= 0px)')
    expect(overrideMediaText('(hover: hover)', touch)).toBe('(width < 0px)')
    expect(overrideMediaText('(pointer:fine) and (min-width: 40rem)', touch)).toBe('(width < 0px) and (min-width: 40rem)')
  })

  test('reduced motion turns the reduce rules on and the no-preference rules off', () => {
    expect(overrideMediaText('(prefers-reduced-motion: reduce)', still)).toBe('(width >= 0px)')
    expect(overrideMediaText('(prefers-reduced-motion: no-preference)', still)).toBe('(width < 0px)')
  })

  test('a query neither setting touches is left alone, so width and colour-scheme rules follow the real frame', () => {
    expect(overrideMediaText('(width < 40rem)', { coarse: true, reducedMotion: true })).toBeUndefined()
    expect(overrideMediaText('(prefers-color-scheme: dark)', { coarse: true, reducedMotion: true })).toBeUndefined()
    expect(overrideMediaText('(pointer: coarse)', off)).toBeUndefined()
  })

  test('applying rewrites nested media rules, and switching off or restoring puts the original text back', () => {
    const nested = { cssRules: [{ cssRules: [{ media: { mediaText: '(pointer: coarse)' }, cssRules: [] }] }] }
    const flat = sheet('(prefers-reduced-motion: reduce)', '(width < 40rem)')
    const emulator = createMediaEmulator()
    expect(emulator.apply([nested, flat], { coarse: true, reducedMotion: true })).toBe(2)
    expect(nested.cssRules[0]!.cssRules[0]!.media.mediaText).toBe('(width >= 0px)')
    expect(flat.cssRules[0]!.media.mediaText).toBe('(width >= 0px)')
    expect(emulator.apply([nested, flat], touch)).toBe(1)
    expect(flat.cssRules[0]!.media.mediaText).toBe('(prefers-reduced-motion: reduce)')
    emulator.restore()
    expect(nested.cssRules[0]!.cssRules[0]!.media.mediaText).toBe('(pointer: coarse)')
    expect(flat.cssRules[1]!.media.mediaText).toBe('(width < 40rem)')
  })

  test('a stylesheet whose rules cannot be read, such as a cross-origin font sheet, is skipped', () => {
    const locked = { get cssRules(): never {
      throw new Error('SecurityError')
    } }
    expect(createMediaEmulator().apply([locked, sheet('(pointer: coarse)')], touch)).toBe(1)
  })

  test('components that ask matchMedia get the emulated answer', () => {
    const original = vi.fn((query: string) => ({ matches: query === '(width >= 0px)', media: query }) as unknown as MediaQueryList)
    const matchMedia = emulatedMatchMedia(original, () => still)
    expect(matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true)
    expect(original).toHaveBeenCalledWith('(width >= 0px)')
    expect(matchMedia('(width < 40rem)').matches).toBe(false)
    expect(original).toHaveBeenLastCalledWith('(width < 40rem)')
  })
})
