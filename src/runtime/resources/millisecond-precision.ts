export function toMillisecondPrecision(value: string): string {
  return value.replace(/(\.\d{3})\d+/, '$1')
}
