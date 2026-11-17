export type ButtonVariant = 'solid' | 'soft' | 'ghost'
export type ButtonTone = 'accent' | 'danger'
export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

export const buttonLooks: Record<ButtonVariant, Record<ButtonTone, { rest: string, hover: string }>> = {
  solid: {
    accent: { rest: 'cwa:bg-accent cwa:text-white', hover: 'cwa:hover:bg-accent-hover' },
    danger: { rest: 'cwa:bg-danger-fill cwa:text-white', hover: 'cwa:hover:bg-danger-fill-hover' },
  },
  soft: {
    accent: { rest: 'cwa:bg-button cwa:text-fg', hover: 'cwa:hover:bg-field-hover' },
    danger: { rest: 'cwa:bg-button cwa:text-danger-fg', hover: 'cwa:hover:bg-field-danger cwa:hover:text-fg' },
  },
  ghost: {
    accent: { rest: 'cwa:bg-transparent cwa:text-fg', hover: 'cwa:hover:bg-button' },
    danger: { rest: 'cwa:bg-transparent cwa:text-danger-fg', hover: 'cwa:hover:bg-button' },
  },
}

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

function colourOf(classes: string, property: 'bg' | 'text', state: '' | 'hover:' = ''): KitLookColour | undefined {
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
  const { rest, hover } = buttonLooks[variant][tone]
  const text = colourOf(rest, 'text')!
  return {
    rest: { fg: text, bg: colourOf(rest, 'bg')! },
    hover: { fg: colourOf(hover, 'text', 'hover:') ?? text, bg: colourOf(hover, 'bg', 'hover:')! },
  }
}

export function badgeLookColours(tone: BadgeTone) {
  const { fill, mark } = badgeTones[tone]
  return { text: colourOf(badgeText, 'text')!, fill: colourOf(fill, 'bg')!, mark: colourOf(mark, 'text')! }
}
