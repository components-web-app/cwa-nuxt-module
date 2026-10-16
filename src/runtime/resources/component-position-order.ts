export function compareSortValues(sortValueA: number | undefined, iriA: string, sortValueB: number | undefined, iriB: string): number {
  const a = sortValueA ?? 0
  const b = sortValueB ?? 0
  if (a !== b) {
    return a - b
  }
  if (iriA === iriB) {
    return 0
  }
  return iriA < iriB ? -1 : 1
}
