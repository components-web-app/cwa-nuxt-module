import { badgeLookColours, badgeTintPercent, buttonLookColours } from '../runtime/templates/components/ui/kit-looks'
import type { BadgeTone, ButtonTone, ButtonVariant, KitLookColour } from '../runtime/templates/components/ui/kit-looks'

export type KitTheme = 'dark' | 'light'

export type KitTokenValue = string | { mix: string, percent: number }

export const kitColourTokens = [
  { name: 'surface', use: 'Bar, modal and page', dark: '#1c1917', light: '#ffffff' },
  { name: 'surface-raised', use: 'Modal footer', dark: '#292524', light: '#f5f5f4' },
  { name: 'surface-menu', use: 'Menu, popover and toast', dark: '#292524', light: '#ffffff' },
  { name: 'button', use: 'Soft button fill', dark: '#44403c', light: '#e7e5e4' },
  { name: 'shimmer', use: 'The band sweeping across skeletons', dark: 'rgb(255 255 255 / 0.24)', light: 'rgb(255 255 255 / 0.9)' },
  { name: 'menu-highlight', use: 'Highlighted menu option', dark: '#57534e', light: '#e7e5e4' },
  { name: 'field', use: 'Every input\'s fill', dark: '#44403c', light: '#d6d3d1' },
  { name: 'field-hover', use: 'Field hover, soft button hover', dark: '#4f4a45', light: '#c9c4c0' },
  { name: 'chip', use: 'Chips inside a field', dark: '#6e6964', light: '#b8b2ad' },
  { name: 'field-danger', use: 'Field in error, soft danger button hover', dark: '#6f514c', light: '#dabfbd' },
  { name: 'field-warning', use: 'Field in conflict', dark: '#6d5e45', light: '#dcc9ad' },
  { name: 'muted-on-field', use: 'Placeholders and muted text on a fill', dark: '#c1bcb7', light: '#4f4a45' },
  { name: 'tree-line', use: 'Tree connector lines', dark: '#78716c', light: '#8a837e' },
  { name: 'toggle-off', use: 'Toggle track when off', dark: '#78716c', light: '#78716c' },
  { name: 'step-hover', use: 'Hover on a control nested in a field', dark: 'rgb(255 255 255 / 0.17)', light: 'rgb(28 25 23 / 0.16)' },
  { name: 'step-press', use: 'A nested control while pressed', dark: 'rgb(255 255 255 / 0.3)', light: 'rgb(28 25 23 / 0.3)' },
  { name: 'type-static', use: 'Static page type', dark: '#60a5fa', light: '#2563eb' },
  { name: 'type-dynamic', use: 'Dynamic page type', dark: '#facc15', light: '#a16207' },
  { name: 'line', use: 'Dividers only', dark: '#44403c', light: '#d6d3d1' },
  { name: 'fg', use: 'Text and values', dark: '#f5f5f4', light: '#1c1917' },
  { name: 'fg-secondary', use: 'Section headings in modals and admin pages', dark: '#d6d3d1', light: '#57534e' },
  { name: 'fg-muted', use: 'Labels in the bar, helper text', dark: '#a8a29e', light: '#57534e' },
  { name: 'accent', use: 'Primary button fill, selected tab, toggle on', dark: '#2563eb', light: '#2563eb' },
  { name: 'accent-hover', use: 'Primary button hover', dark: '#1d4ed8', light: '#1d4ed8' },
  { name: 'accent-fg', use: 'Focus ring, links, accent text', dark: '#60a5fa', light: '#1d4ed8' },
  { name: 'accent-tint', use: 'Accent badge fill', dark: { mix: 'accent', percent: 28 }, light: { mix: 'accent', percent: 12 } },
  { name: 'success', use: 'Saved glyph', dark: '#9cdd05', light: '#3f6212' },
  { name: 'line-saving', use: 'Bar status line while saving', dark: '#93c5fd', light: '#1d4ed8' },
  { name: 'line-saved', use: 'Bar status line once saved', dark: '#9cdd05', light: '#3f6212' },
  { name: 'line-danger', use: 'Bar status line, error', dark: '#fecaca', light: '#991b1b' },
  { name: 'line-warning', use: 'Bar status line, conflict', dark: '#fcd34d', light: '#92400e' },
  { name: 'warning', use: 'Conflict and long-wait glyph', dark: '#ffaa00', light: '#b45309' },
  { name: 'danger', use: 'Error glyph', dark: '#fca5a5', light: '#b91c1c' },
  { name: 'danger-fill', use: 'Destructive button fill', dark: '#dc2626', light: '#dc2626' },
  { name: 'danger-fill-hover', use: 'Destructive button hover', dark: '#b91c1c', light: '#b91c1c' },
  { name: 'danger-fg', use: 'Error text', dark: '#fca5a5', light: '#b91c1c' },
  { name: 'highlight', use: 'Reorder, clone and selection', dark: '#e30a6c', light: '#e30a6c' },
] as const satisfies readonly { name: string, use: string, dark: KitTokenValue, light: KitTokenValue }[]

export type KitColourToken = typeof kitColourTokens[number]['name']

export type KitColour = KitColourToken | 'white' | 'transparent' | { tint: KitColourToken, percent: number }

export interface KitContrastPair {
  fg: KitColour
  bg: KitColour
  min: 3 | 4.5
  use: string
}

const tokenValues = new Map<string, Record<KitTheme, KitTokenValue>>(kitColourTokens.map(token => [token.name, token]))

function isToken(name: string): name is KitColourToken {
  return tokenValues.has(name)
}

function asKitColour(colour: KitLookColour): KitColour {
  if (typeof colour === 'object') {
    if (!isToken(colour.tint)) {
      throw new Error(`"${colour.tint}" is not a kit colour token`)
    }
    return { tint: colour.tint, percent: badgeTintPercent }
  }
  if (colour === 'white' || colour === 'transparent' || isToken(colour)) {
    return colour
  }
  throw new Error(`"${colour}" is not a kit colour token`)
}

function capitalise(word: string): string {
  return `${word[0]!.toUpperCase()}${word.slice(1)}`
}

const buttonVariants: ButtonVariant[] = ['solid', 'soft', 'ghost']
const buttonTones: ButtonTone[] = ['accent', 'danger']
const badgeTones: BadgeTone[] = ['neutral', 'accent', 'success', 'warning', 'danger']

function buttonPairs(): KitContrastPair[] {
  return buttonVariants.flatMap(variant => buttonTones.flatMap((tone) => {
    const { rest, hover } = buttonLookColours(variant, tone)
    return [
      { fg: asKitColour(rest.fg), bg: asKitColour(rest.bg), min: 4.5 as const, use: `${capitalise(variant)} ${tone} button` },
      { fg: asKitColour(hover.fg), bg: asKitColour(hover.bg), min: 4.5 as const, use: `${capitalise(variant)} ${tone} button on hover` },
    ]
  }))
}

function badgePairs(): KitContrastPair[] {
  return badgeTones.flatMap((tone) => {
    const { text, fill, mark } = badgeLookColours(tone)
    return [
      { fg: asKitColour(text), bg: asKitColour(fill), min: 4.5 as const, use: `${capitalise(tone)} badge` },
      { fg: asKitColour(mark), bg: asKitColour(fill), min: 3 as const, use: `${capitalise(tone)} badge dot` },
    ]
  })
}

export const kitContrastPairs: KitContrastPair[] = [
  { fg: 'fg', bg: 'surface', min: 4.5, use: 'Text' },
  { fg: 'fg', bg: 'surface-raised', min: 4.5, use: 'Text on a modal footer' },
  { fg: 'fg', bg: 'surface-menu', min: 4.5, use: 'Text in a menu' },
  { fg: 'fg', bg: 'menu-highlight', min: 4.5, use: 'Highlighted option' },
  { fg: 'fg', bg: 'field', min: 4.5, use: 'Field value, neutral badge' },
  { fg: 'fg', bg: 'field-hover', min: 4.5, use: 'Field value on hover' },
  { fg: 'muted-on-field', bg: 'field', min: 4.5, use: 'Placeholder' },
  { fg: 'muted-on-field', bg: 'field-hover', min: 4.5, use: 'Placeholder on hover' },
  { fg: 'fg-secondary', bg: 'surface', min: 4.5, use: 'Section heading' },
  { fg: 'fg-muted', bg: 'surface', min: 4.5, use: 'Bar label, helper text, secondary link' },
  { fg: 'accent-fg', bg: 'surface', min: 4.5, use: 'Link, focus ring' },
  { fg: 'danger-fg', bg: 'surface', min: 4.5, use: 'Error text' },
  { fg: 'success', bg: 'field', min: 3, use: 'Saved glyph' },
  { fg: 'line-saving', bg: 'field', min: 3, use: 'Saving line' },
  { fg: 'line-saving', bg: 'field-hover', min: 3, use: 'Saving line on hover' },
  { fg: 'line-saved', bg: 'field', min: 3, use: 'Saved line' },
  { fg: 'line-saved', bg: 'field-hover', min: 3, use: 'Saved line on hover' },
  { fg: 'line-danger', bg: 'field-danger', min: 3, use: 'Error line' },
  { fg: 'line-warning', bg: 'field-warning', min: 3, use: 'Conflict line' },
  { fg: 'danger', bg: 'field-danger', min: 3, use: 'Error glyph' },
  { fg: 'warning', bg: 'field-warning', min: 3, use: 'Conflict glyph' },
  { fg: 'type-static', bg: 'surface', min: 3, use: 'Static page marker' },
  { fg: 'type-dynamic', bg: 'surface', min: 3, use: 'Dynamic page marker' },
  { fg: 'success', bg: 'surface', min: 3, use: 'Reachable page data, dialog edge' },
  { fg: 'warning', bg: 'surface', min: 3, use: 'Unreachable page data, dialog edge' },
  { fg: 'toggle-off', bg: 'surface', min: 3, use: 'Toggle track, off' },
  { fg: 'tree-line', bg: 'surface', min: 3, use: 'Tree line' },
  ...buttonPairs(),
  ...badgePairs(),
]

export function kitTokenCss(value: KitTokenValue): string {
  return typeof value === 'string' ? value : `color-mix(in srgb, var(--cwa-color-${value.mix}) ${value.percent}%, var(--cwa-color-surface))`
}

export function kitThemeStyle(theme: KitTheme): Record<string, string> {
  return Object.fromEntries(kitColourTokens.map(token => [`--cwa-color-${token.name}`, kitTokenCss(token[theme])]))
}

export function kitTokenValue(token: KitColourToken, theme: KitTheme): KitTokenValue {
  return tokenValues.get(token)![theme]
}

export type Rgba = [number, number, number, number]

export function parseColour(value: string): Rgba {
  const colour = value.trim()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(colour)
  if (hex) {
    const digits = hex[1]!.length === 3 ? [...hex[1]!].map(d => d + d).join('') : hex[1]!
    return [0, 2, 4].map(i => Number.parseInt(digits.slice(i, i + 2), 16)).concat(1) as Rgba
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[/,]\s*([\d.]+%?))?\s*\)$/i.exec(colour)
  if (rgb) {
    const alpha = rgb[4] === undefined ? 1 : rgb[4].endsWith('%') ? Number.parseFloat(rgb[4]) / 100 : Number.parseFloat(rgb[4])
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), alpha]
  }
  throw new Error(`Unsupported colour "${value}"`)
}

function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top[3]
  return [0, 1, 2].map(i => top[i]! * a + bottom[i]! * (1 - a)).concat(1) as Rgba
}

function luminance([r, g, b]: Rgba): number {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lr! + 0.7152 * lg! + 0.0722 * lb!
}

export function contrastRatio(fg: Rgba, bg: Rgba): number {
  const front = fg[3] < 1 ? over(fg, bg) : fg
  const [high, low] = [luminance(front), luminance(bg)].sort((a, b) => b - a)
  return (high! + 0.05) / (low! + 0.05)
}

function mix(top: Rgba, bottom: Rgba, percent: number): Rgba {
  const amount = percent / 100
  return [0, 1, 2].map(i => top[i]! * amount + bottom[i]! * (1 - amount)).concat(1) as Rgba
}

export function resolveKitColour(colour: KitColour, theme: KitTheme): Rgba {
  if (colour === 'white') {
    return [255, 255, 255, 1]
  }
  const surface = parseColour(kitTokenValue('surface', theme) as string)
  if (colour === 'transparent') {
    return surface
  }
  if (typeof colour === 'object') {
    return mix(resolveKitColour(colour.tint, theme), surface, colour.percent)
  }
  const value = kitTokenValue(colour, theme)
  if (typeof value === 'object') {
    return mix(resolveKitColour(value.mix as KitColourToken, theme), surface, value.percent)
  }
  const parsed = parseColour(value)
  return parsed[3] < 1 ? over(parsed, surface) : parsed
}

export function measureKitPair(pair: KitContrastPair, theme: KitTheme): number {
  return contrastRatio(resolveKitColour(pair.fg, theme), resolveKitColour(pair.bg, theme))
}

export function kitColourLabel(colour: KitColour): string {
  if (colour === 'transparent') {
    return 'surface (transparent)'
  }
  return typeof colour === 'object' ? `${colour.tint} at ${colour.percent}%` : colour
}
