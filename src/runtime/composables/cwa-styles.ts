// Mapping between a component's declared styles and the flat `uiClassNames: string[]` stored on the
// resource, for the MULTIPLE-style case (`StyleOptions.multiple === true`).
//
// Each SELECTED style occupies exactly one `uiClassNames` entry — that style's class list joined into
// a single space-separated string. This keeps entries 1:1 with styles (a class shared by two styles
// is never duplicated in the saved array) and makes selection detection an exact string match rather
// than a subset check. Single-select style mode is unaffected — it continues to store a style's raw
// class array as its whole value.

export type StyleClasses = Record<string, string[]>

// One `uiClassNames` entry per selected style — its classes joined — in the styles' declaration order
// (not selection order), so the saved value is deterministic.
export function mergeSelectedStyles(selectedNames: string[], classes: StyleClasses): string[] {
  const entries: string[] = []
  for (const [name, styleClasses] of Object.entries(classes)) {
    if (selectedNames.includes(name)) {
      entries.push(styleClasses.join(' '))
    }
  }
  return entries
}

// The names of styles whose joined class string is present in `uiClassNames` (exact match), in
// declaration order. The inverse of `mergeSelectedStyles`.
export function deriveSelectedStyles(uiClassNames: string[] | undefined | null, classes: StyleClasses): string[] {
  if (!uiClassNames?.length) {
    return []
  }
  const present = new Set(uiClassNames)
  const names: string[] = []
  for (const [name, styleClasses] of Object.entries(classes)) {
    if (present.has(styleClasses.join(' '))) {
      names.push(name)
    }
  }
  return names
}
