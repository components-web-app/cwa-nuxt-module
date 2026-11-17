import type { CwaStyleClasses, CwaStyles } from '#cwa/types'

const STYLE_PREFIX = 'style:'

function styleKeys(uiClassNames: string[] | null | undefined): string[] {
  return (uiClassNames ?? [])
    .filter(entry => entry.startsWith(STYLE_PREFIX))
    .map(entry => entry.slice(STYLE_PREFIX.length))
}

export function resolveStyleClasses(styleClasses: CwaStyleClasses, componentName: string | undefined, uiClassNames: string[] | null | undefined): string[] {
  const own = componentName && Object.hasOwn(styleClasses, componentName) ? styleClasses[componentName] : undefined
  if (!own) {
    return []
  }
  return styleKeys(uiClassNames)
    .filter(key => Object.hasOwn(own, key))
    .map(key => own[key]!)
}

export function selectedStyleKeys(uiClassNames: string[] | null | undefined, styles: CwaStyles | undefined): string[] {
  if (!styles) {
    return []
  }
  const stored = styleKeys(uiClassNames)
  return Object.keys(styles).filter(key => stored.includes(key))
}

export function selectStyleKeys(uiClassNames: string[] | null | undefined, styles: CwaStyles | undefined, keys: string[]): string[] | null {
  const known = Object.keys(styles ?? {}).map(key => `${STYLE_PREFIX}${key}`)
  const kept = (uiClassNames ?? []).filter(entry => !known.includes(entry))
  const next = [...kept, ...keys.map(key => `${STYLE_PREFIX}${key}`)]
  return next.length ? next : null
}
