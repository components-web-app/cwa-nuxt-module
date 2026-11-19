export type ButtonVariant = 'solid' | 'soft' | 'ghost'
export type ButtonTone = 'accent' | 'danger'
export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

export const buttonLooks: Record<ButtonVariant, Record<ButtonTone, { rest: string, hover: string, open: string }>> = {
  solid: {
    accent: { rest: 'cwa:bg-accent cwa:text-white', hover: 'cwa:hover:bg-accent-hover', open: 'cwa:aria-expanded:bg-accent-open' },
    danger: { rest: 'cwa:bg-danger-fill cwa:text-white', hover: 'cwa:hover:bg-danger-fill-hover', open: 'cwa:aria-expanded:bg-danger-fill-open' },
  },
  soft: {
    accent: { rest: 'cwa:bg-button cwa:text-fg', hover: 'cwa:hover:bg-field-hover', open: 'cwa:aria-expanded:bg-field-hover' },
    danger: { rest: 'cwa:bg-button cwa:text-danger-fg', hover: 'cwa:hover:bg-field-danger cwa:hover:text-fg', open: 'cwa:aria-expanded:bg-field-danger cwa:aria-expanded:text-fg' },
  },
  ghost: {
    accent: { rest: 'cwa:bg-transparent cwa:text-fg', hover: 'cwa:hover:bg-button', open: 'cwa:aria-expanded:bg-button' },
    danger: { rest: 'cwa:bg-transparent cwa:text-danger-fg', hover: 'cwa:hover:bg-button', open: 'cwa:aria-expanded:bg-button' },
  },
}

export const openTriggerMark = 'cwa:aria-expanded:shadow-[inset_0_-2px_0_currentColor]'

export const badgeTintPercent = 18

export const badgeText = 'cwa:text-fg'

export const badgeTones: Record<BadgeTone, { fill: string, mark: string }> = {
  neutral: { fill: 'cwa:bg-field', mark: 'cwa:text-fg-muted' },
  accent: { fill: 'cwa:bg-accent-tint', mark: 'cwa:text-accent-fg' },
  success: { fill: 'cwa:bg-[color-mix(in_srgb,var(--cwa-color-success)_var(--cwa-badge-tint),var(--cwa-color-surface))]', mark: 'cwa:text-success' },
  warning: { fill: 'cwa:bg-[color-mix(in_srgb,var(--cwa-color-warning)_var(--cwa-badge-tint),var(--cwa-color-surface))]', mark: 'cwa:text-warning' },
  danger: { fill: 'cwa:bg-[color-mix(in_srgb,var(--cwa-color-danger)_var(--cwa-badge-tint),var(--cwa-color-surface))]', mark: 'cwa:text-danger' },
}

export type KitLookColour = string | { tint: string }

function colourOf(classes: string, property: 'bg' | 'text', state: '' | 'hover:' | 'aria-expanded:' = ''): KitLookColour | undefined {
  for (const name of classes.split(/\s+/)) {
    const prefix = `cwa:${state}${property}-`
    if (!name.startsWith(prefix)) {
      continue
    }
    const value = name.slice(prefix.length)
    const tint = /^\[color-mix\(in_srgb,var\(--cwa-color-([a-z-]+)\)_var\(--cwa-badge-tint\),var\(--cwa-color-surface\)\)\]$/.exec(value)
    if (tint) {
      return { tint: tint[1]! }
    }
    if (/^[a-z-]+$/.test(value)) {
      return value
    }
    throw new Error(`Unrecognised colour class "${name}"`)
  }
  return undefined
}

export function buttonLookColours(variant: ButtonVariant, tone: ButtonTone) {
  const { rest, hover, open } = buttonLooks[variant][tone]
  const text = colourOf(rest, 'text')!
  return {
    rest: { fg: text, bg: colourOf(rest, 'bg')! },
    hover: { fg: colourOf(hover, 'text', 'hover:') ?? text, bg: colourOf(hover, 'bg', 'hover:')! },
    open: { fg: colourOf(open, 'text', 'aria-expanded:') ?? text, bg: colourOf(open, 'bg', 'aria-expanded:')! },
  }
}

export function badgeLookColours(tone: BadgeTone) {
  const { fill, mark } = badgeTones[tone]
  return { text: colourOf(badgeText, 'text')!, fill: colourOf(fill, 'bg')!, mark: colourOf(mark, 'text')! }
}
