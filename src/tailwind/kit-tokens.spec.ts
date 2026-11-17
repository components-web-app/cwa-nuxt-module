// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { contrastRatio, kitColourLabel, kitColourTokens, kitContrastPairs, measureKitPair, parseColour } from './kit-tokens'
import type { KitColourToken } from './kit-tokens'

const compiled = readFileSync(fileURLToPath(new URL('../runtime/templates/assets/cwa.css', import.meta.url)), 'utf8')

function block(selector: string): string {
  const start = compiled.indexOf(`${selector} {`)
  if (start === -1) {
    throw new Error(`No "${selector}" block in cwa.css`)
  }
  return compiled.slice(start, compiled.indexOf('}', start))
}

function colours(selector: string): Record<string, string> {
  return Object.fromEntries([...block(selector).matchAll(/--cwa-color-([a-z-]+):\s*([^;]+);/g)].map(m => [m[1], m[2]!.trim()]))
}

const themes = {
  dark: colours(':root, :host'),
  light: colours('.cwa\\:theme-light'),
}

describe('kit colour tokens (#456)', () => {
  test('the contrast maths matches WCAG\'s', () => {
    expect(contrastRatio(parseColour('#ffffff'), parseColour('#000000'))).toBeCloseTo(21, 5)
    expect(contrastRatio(parseColour('#f5f5f4'), parseColour('#57534e'))).toBeCloseTo(6.99, 2)
    expect(contrastRatio(parseColour('rgb(255 255 255 / .5)'), parseColour('#000'))).toBeCloseTo(contrastRatio(parseColour('#808080'), parseColour('#000')), 1)
    expect(() => parseColour('oklch(50% 0.1 20)')).toThrow('Unsupported colour')
  })

  test.each(['dark', 'light'] as const)('every token has a %s value, emitted even when no utility uses it', (theme) => {
    for (const { name } of kitColourTokens) {
      expect(themes[theme], name).toHaveProperty(name)
      expect(() => parseColour(themes[theme][name]!)).not.toThrow()
    }
  })

  test('dark is the default and light is a theme of its own, with the values the proposal measured', () => {
    expect(themes.dark).toMatchObject({ 'surface': '#1c1917', 'field': '#57534e', 'button': '#44403c', 'fg': '#f5f5f4', 'accent-fg': '#60a5fa', 'danger-fg': '#fca5a5', 'shimmer': 'rgb(255 255 255 / 0.24)' })
    expect(themes.light).toMatchObject({ 'surface': '#ffffff', 'field': '#d6d3d1', 'button': '#e7e5e4', 'fg': '#1c1917', 'accent-fg': '#1d4ed8', 'danger-fg': '#b91c1c', 'shimmer': 'rgb(255 255 255 / 0.9)' })
  })

  describe.each(['dark', 'light'] as const)('in %s', (theme) => {
    const read = (token: KitColourToken) => themes[theme][token]!
    test.each(kitContrastPairs.map(pair => [`${kitColourLabel(pair.fg)} on ${kitColourLabel(pair.bg)} (${pair.use})`, pair] as const))('%s meets its minimum', (_, pair) => {
      expect(measureKitPair(pair, read)).toBeGreaterThanOrEqual(pair.min)
    })
  })

  test('the colours the admin already uses keep their names', () => {
    for (const name of ['dark', 'light', 'medium', 'danger', 'danger-dark', 'magenta', 'orange', 'green', 'stone-700']) {
      expect(compiled, name).toContain(`--cwa-color-${name}:`)
    }
  })

  test('the kit\'s tokens are in the compiled CSS: type, coarse-pointer sizes and the reduced-motion switch', () => {
    expect(compiled).toMatch(/--cwa-text-flag:\s*0\.75rem;/)
    expect(compiled).toMatch(/--cwa-text-flag--font-weight:\s*600;/)
    expect(compiled).toMatch(/@media \(pointer: coarse\)\s*{\s*:root, :host\s*{[^}]*--cwa-spacing-control:\s*2\.75rem;/)
    expect(compiled).toMatch(/\.cwa\\:reduce-motion/)
    expect(compiled).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*{\s*\.cwa\\:reduced-motion\\:animate-spinner-reduced/)
  })
})
