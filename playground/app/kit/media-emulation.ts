export interface KitMediaOverrides {
  coarse: boolean
  reducedMotion: boolean
}

const ALWAYS = '(width >= 0px)'
const NEVER = '(width < 0px)'

function feature(name: string, value?: string) {
  return new RegExp(value ? `\\(\\s*${name}\\s*:\\s*${value}\\s*\\)` : `\\(\\s*${name}\\s*\\)`, 'gi')
}

const coarseRules: [RegExp, string][] = [
  [feature('pointer', 'coarse'), ALWAYS],
  [feature('pointer', 'fine'), NEVER],
  [feature('pointer', 'none'), NEVER],
  [feature('any-pointer', 'coarse'), ALWAYS],
  [feature('any-pointer', 'fine'), NEVER],
  [feature('hover', 'hover'), NEVER],
  [feature('hover', 'none'), ALWAYS],
  [feature('any-hover', 'hover'), NEVER],
  [feature('any-hover', 'none'), ALWAYS],
  [feature('hover'), NEVER],
]

const motionRules: [RegExp, string][] = [
  [feature('prefers-reduced-motion', 'reduce'), ALWAYS],
  [feature('prefers-reduced-motion', 'no-preference'), NEVER],
  [feature('prefers-reduced-motion'), ALWAYS],
]

export function overrideMediaText(text: string, overrides: KitMediaOverrides): string | undefined {
  const rules = [...(overrides.coarse ? coarseRules : []), ...(overrides.reducedMotion ? motionRules : [])]
  const next = rules.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text)
  return next === text ? undefined : next
}

interface MediaRuleLike {
  media?: { mediaText: string }
  cssRules?: ArrayLike<MediaRuleLike>
}

interface SheetLike {
  cssRules: ArrayLike<MediaRuleLike>
}

export interface KitMediaEmulator {
  apply: (sheets: Iterable<SheetLike>, overrides: KitMediaOverrides) => number
  restore: () => void
}

function rulesOf(sheet: SheetLike | MediaRuleLike): MediaRuleLike[] {
  try {
    return Array.from(sheet.cssRules ?? [])
  }
  catch {
    return []
  }
}

export function createMediaEmulator(): KitMediaEmulator {
  const originals = new Map<MediaRuleLike, string>()

  function visit(rule: MediaRuleLike, overrides: KitMediaOverrides): number {
    let changed = 0
    if (rule.media) {
      const original = originals.get(rule) ?? rule.media.mediaText
      const wanted = overrideMediaText(original, overrides) ?? original
      if (rule.media.mediaText !== wanted) {
        originals.set(rule, original)
        rule.media.mediaText = wanted
        changed++
      }
    }
    for (const child of rulesOf(rule)) {
      changed += visit(child, overrides)
    }
    return changed
  }

  return {
    apply: (sheets, overrides) => {
      let changed = 0
      for (const sheet of sheets) {
        for (const rule of rulesOf(sheet)) {
          changed += visit(rule, overrides)
        }
      }
      return changed
    },
    restore: () => {
      for (const [rule, text] of originals) {
        if (rule.media) {
          rule.media.mediaText = text
        }
      }
      originals.clear()
    },
  }
}

export function emulatedMatchMedia(original: (query: string) => MediaQueryList, overrides: () => KitMediaOverrides) {
  return (query: string) => original(overrideMediaText(query, overrides()) ?? query)
}
