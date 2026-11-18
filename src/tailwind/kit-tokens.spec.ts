// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { badgeLookColours, badgeTintPercent, badgeTones, buttonLookColours, buttonLooks } from '../runtime/templates/components/ui/kit-looks'
import type { KitLookColour } from '../runtime/templates/components/ui/kit-looks'
import { contrastRatio, kitColourLabel, kitColourTokens, kitContrastPairs, kitThemeStyle, kitTokenCss, measureKitPair, parseColour, resolveKitColour } from './kit-tokens'

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const source = read('./tailwind-cwa.css')
const compiled = read('../runtime/templates/assets/cwa.css')

function block(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) {
    throw new Error(`No "${selector}" block`)
  }
  let depth = 0
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    depth += css[i] === '{' ? 1 : css[i] === '}' ? -1 : 0
    if (depth === 0) {
      return css.slice(start, i + 1)
    }
  }
  throw new Error(`Unclosed "${selector}" block`)
}

function declarations(css: string, prefix: string): Map<string, string> {
  return new Map([...css.matchAll(new RegExp(`${prefix}([a-z0-9-]+):\\s*([^;]+);`, 'g'))].map(m => [m[1]!, m[2]!.trim()]))
}

const compiledTheme = block(compiled, ':root, :host')
const compiledColours = declarations(compiledTheme, '--cwa-color-')
const outsideTheme = compiled.replace(compiledTheme, '')
const tokenNames = kitColourTokens.map(token => token.name)

function themeValues(theme: 'dark' | 'light'): Record<string, string> {
  return Object.fromEntries(Object.entries(kitThemeStyle(theme)).map(([property, value]) => [property.replace(/^--cwa-color-/, ''), value]))
}

function tokenOf(colour: KitLookColour): string {
  return typeof colour === 'object' ? colour.tint : colour
}

describe('kit colour tokens (#456)', () => {
  test('the contrast maths matches WCAG\'s', () => {
    expect(contrastRatio(parseColour('#ffffff'), parseColour('#000000'))).toBeCloseTo(21, 5)
    expect(contrastRatio(parseColour('#f5f5f4'), parseColour('#57534e'))).toBeCloseTo(6.99, 2)
    expect(contrastRatio(parseColour('rgb(255 255 255 / .5)'), parseColour('#000'))).toBeCloseTo(contrastRatio(parseColour('#808080'), parseColour('#000')), 1)
    expect(() => parseColour('oklch(50% 0.1 20)')).toThrow('Unsupported colour')
  })

  test.each(['dark', 'light'] as const)('every token has a %s value: a colour, or a mix of another token over the surface', (theme) => {
    for (const token of kitColourTokens) {
      const value = token[theme]
      if (typeof value === 'string') {
        expect(() => parseColour(value), token.name).not.toThrow()
      }
      else {
        expect(tokenNames, token.name).toContain(value.mix)
      }
    }
  })

  test('the accent tint is opaque: the accent mixed over the surface, as the badge tints are', () => {
    expect(kitTokenCss(kitColourTokens.find(token => token.name === 'accent-tint')!.dark)).toBe('color-mix(in srgb, var(--cwa-color-accent) 28%, var(--cwa-color-surface))')
    expect(kitTokenCss(kitColourTokens.find(token => token.name === 'accent-tint')!.light)).toBe('color-mix(in srgb, var(--cwa-color-accent) 12%, var(--cwa-color-surface))')
  })

  test('dark is the default and light is a theme of its own, with the values the proposal measured', () => {
    expect(themeValues('dark')).toMatchObject({ 'surface': '#1c1917', 'field': '#44403c', 'button': '#44403c', 'fg': '#f5f5f4', 'accent-fg': '#60a5fa', 'danger-fg': '#fca5a5', 'shimmer': 'rgb(255 255 255 / 0.24)' })
    expect(themeValues('light')).toMatchObject({ 'surface': '#ffffff', 'field': '#d6d3d1', 'button': '#e7e5e4', 'fg': '#1c1917', 'accent-fg': '#1d4ed8', 'danger-fg': '#b91c1c', 'shimmer': 'rgb(255 255 255 / 0.9)' })
  })

  test('the Tailwind theme declares every token with its dark value from kit-tokens.ts', () => {
    const themed = declarations(source, '--color-')
    for (const token of kitColourTokens) {
      expect(themed.get(token.name), token.name).toBe(kitTokenCss(token.dark))
    }
  })

  test('the compiled CSS emits only the tokens a utility uses, each with its kit-tokens.ts value', () => {
    const emitted = tokenNames.filter(name => compiledColours.has(name))
    expect(emitted.length).toBeGreaterThan(0)
    expect(emitted.length).toBeLessThan(tokenNames.length)
    for (const name of emitted) {
      expect(compiledColours.get(name), name).toBe(kitTokenCss(kitColourTokens.find(token => token.name === name)!.dark))
      expect(outsideTheme.includes(`var(--cwa-color-${name})`) || compiledTheme.includes(`var(--cwa-color-${name})`), `${name} is emitted but nothing uses it`).toBe(true)
    }
  })

  test('every token the components colour with is in the compiled CSS', () => {
    const buttons = (['solid', 'soft', 'ghost'] as const).flatMap(variant => (['accent', 'danger'] as const).flatMap((tone) => {
      const { rest, hover } = buttonLookColours(variant, tone)
      return [rest.fg, rest.bg, hover.fg, hover.bg]
    }))
    const badges = (['neutral', 'accent', 'success', 'warning', 'danger'] as const).flatMap((tone) => {
      const { text, fill, mark } = badgeLookColours(tone)
      return [text, fill, mark]
    })
    const used = new Set([...buttons, ...badges].map(tokenOf).filter(name => name !== 'white' && name !== 'transparent'))
    expect(used.size).toBeGreaterThan(10)
    for (const name of used) {
      expect(compiledColours.has(name), name).toBe(true)
    }
  })

  test('the light theme and touch sizes cost visitors nothing: neither is in the compiled CSS', () => {
    expect(compiled).not.toContain('theme-light')
    expect(compiled).not.toMatch(/@media \(pointer: coarse\)\s*{\s*:root/)
    expect(compiled).not.toContain('reduce-motion')
  })

  test('the contrast pairs measure the components\' own colours, from the maps Button and Badge render', () => {
    expect(buttonLooks.solid.accent.rest).toBe('cwa:bg-accent cwa:text-white')
    expect(kitContrastPairs).toEqual(expect.arrayContaining([
      expect.objectContaining({ fg: 'white', bg: 'accent', min: 4.5 }),
      expect.objectContaining({ fg: 'white', bg: 'accent-hover', min: 4.5 }),
      expect.objectContaining({ fg: 'danger-fg', bg: 'transparent', min: 4.5 }),
      expect.objectContaining({ fg: 'fg', bg: 'field-danger', min: 4.5 }),
      expect.objectContaining({ fg: 'fg', bg: 'accent-tint', min: 4.5 }),
      expect.objectContaining({ fg: 'accent-fg', bg: 'accent-tint', min: 3 }),
      expect.objectContaining({ fg: 'fg-muted', bg: 'field', min: 3 }),
      ...(['success', 'warning', 'danger'] as const).flatMap(tone => [
        expect.objectContaining({ fg: 'fg', bg: { tint: tone, percent: badgeTintPercent }, min: 4.5 }),
        expect.objectContaining({ fg: tone, bg: { tint: tone, percent: badgeTintPercent }, min: 3 }),
      ]),
    ]))
    expect(badgeTones.success.fill).toContain('var(--cwa-badge-tint)')
  })

  describe.each(['dark', 'light'] as const)('in %s', (theme) => {
    test.each(kitContrastPairs.map(pair => [`${kitColourLabel(pair.fg)} on ${kitColourLabel(pair.bg)} (${pair.use})`, pair] as const))('%s meets its minimum', (_, pair) => {
      expect(measureKitPair(pair, theme)).toBeGreaterThanOrEqual(pair.min)
    })
  })

  test.each(['dark', 'light'] as const)('in %s a placeholder reads clearly dimmer than a typed value, at least 1.5:1 between the two, so an empty field never looks filled in', (theme) => {
    expect(contrastRatio(resolveKitColour('fg', theme), resolveKitColour('muted-on-field', theme))).toBeGreaterThanOrEqual(1.5)
  })

  test('the colours the admin already uses keep their names', () => {
    for (const name of ['dark', 'light', 'danger', 'danger-dark', 'magenta', 'orange', 'green', 'stone-700']) {
      expect(compiled, name).toContain(`--cwa-color-${name}:`)
    }
  })

  test('no theme variable refers to a variable the CSS never defines, which would render it transparent or inherited', () => {
    const defined = new Set([...compiled.matchAll(/(--[a-z0-9-]+):/g)].map(m => m[1]!))
    const references = [...compiledTheme.matchAll(/(--cwa-[a-z0-9-]+):\s*([^;]+);/g)].flatMap(m => [...m[2]!.matchAll(/var\((--[a-z0-9-]+)/g)].map(ref => [m[1]!, ref[1]!] as const))
    expect(references.length).toBeGreaterThan(0)
    for (const [variable, reference] of references) {
      expect(defined.has(reference), `${variable} uses ${reference}`).toBe(true)
    }
  })

  test('danger-dark is red-800 at 80%', () => {
    expect(compiledColours.get('danger-dark')).toBe('oklch(44.4% 0.177 26.899 / 0.8)')
  })

  test('the manager bar\'s touch and narrow sizes are compiled, on the bar rather than the root, with one CTA inset, the tab row the hit size plus the bar\'s line (#459)', () => {
    const enclosing = (at: number) => {
      const before = compiled.slice(0, at)
      return before.slice(Math.max(before.lastIndexOf('@media ('), before.lastIndexOf('@container ('))).match(/\(([^)]+)\)/)?.[1]
    }
    const setUnder = (property: string, value: string) => [...compiled.matchAll(new RegExp(`{\\s*${property}:\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')};`, 'g'))].map(match => enclosing(match.index)).sort()

    expect(compiled).toMatch(/--cwa-spacing-cta-inset:\s*0\.25rem;/)
    expect(setUnder('--cwa-spacing-manager-tabs', 'calc(2.75rem + 1px)')).toEqual(['pointer: coarse'])
    expect(setUnder('--cwa-spacing-manager-row', 'calc(4.25rem - 1px)')).toEqual(['pointer: coarse'])
    expect(setUnder('--cwa-spacing-manager', '7rem')).toEqual(['pointer: coarse'])
    expect(setUnder('--cwa-spacing-cta-inset', '0px')).toEqual(['pointer: coarse', 'width < 40rem'])
  })

  test('the kit\'s type and motion tokens are in the compiled CSS, and reduced motion follows the system setting', () => {
    expect(compiled).toMatch(/--cwa-text-flag:\s*0\.75rem;/)
    expect(compiled).toMatch(/--cwa-text-flag--font-weight:\s*600;/)
    expect(compiled).toMatch(/--cwa-duration-fast:\s*120ms;/)
    expect(compiled).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*{\s*\.cwa\\:motion-reduce\\:animate-spinner-reduced/)
  })
})
