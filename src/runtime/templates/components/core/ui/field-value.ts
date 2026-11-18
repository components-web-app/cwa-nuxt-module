export type FieldValueFormat = (value: unknown) => string

export function shownValue(value: unknown, format?: FieldValueFormat): string {
  if (value === null || value === undefined || value === '') {
    return 'Empty'
  }
  const formatted = format?.(value)
  if (formatted) {
    return formatted
  }
  return typeof value === 'string' ? value : JSON.stringify(value)
}
