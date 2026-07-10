// Mapping between a component's declared styles and the flat `uiClassNames: string[]` stored on the
// resource — used for BOTH single- and multiple-style selection.
//
// A style's value is its class string (e.g. `'border border-gray-200'`); a `string[]` is also
// accepted and normalised by joining. Each SELECTED style occupies exactly ONE `uiClassNames` entry
// (its class string), so the saved array is always one-entry-per-style — for a single select that is
// a one-element array, for a multiple select an array of N. This keeps entries 1:1 with styles (no
// duplicate class tokens across overlapping styles) and makes detection an exact string match.

export type StyleClassValue = string | string[]
export type StyleClasses = Record<string, StyleClassValue>

// A style's class value as a single space-separated string (arrays are joined).
export function toClassString(value: StyleClassValue): string {
  return Array.isArray(value) ? value.join(' ') : value
}

// One `uiClassNames` entry per selected style — its class string — in the styles' declaration order
// (not selection order), so the saved value is deterministic.
export function mergeSelectedStyles(selectedNames: string[], classes: StyleClasses): string[] {
  const entries: string[] = []
  for (const [name, value] of Object.entries(classes)) {
    if (selectedNames.includes(name)) {
      entries.push(toClassString(value))
    }
  }
  return entries
}

// The names of styles whose class string is present in `uiClassNames` (exact match), in declaration
// order. The inverse of `mergeSelectedStyles`.
export function deriveSelectedStyles(uiClassNames: string[] | undefined | null, classes: StyleClasses): string[] {
  if (!uiClassNames?.length) {
    return []
  }
  const present = new Set(uiClassNames)
  const names: string[] = []
  for (const [name, value] of Object.entries(classes)) {
    if (present.has(toClassString(value))) {
      names.push(name)
    }
  }
  return names
}
