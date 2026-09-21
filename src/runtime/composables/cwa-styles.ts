export type StyleClassValue = string | string[]
export type StyleClasses = Record<string, StyleClassValue>

export function toClassString(value: StyleClassValue): string {
  return Array.isArray(value) ? value.join(' ') : value
}

export function mergeSelectedStyles(selectedNames: string[], classes: StyleClasses): string[] {
  const entries: string[] = []
  for (const [name, value] of Object.entries(classes)) {
    if (selectedNames.includes(name)) {
      entries.push(toClassString(value))
    }
  }
  return entries
}

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
