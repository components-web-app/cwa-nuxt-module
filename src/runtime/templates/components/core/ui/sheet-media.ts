export const SHEET_QUERY = '(max-width: 639.98px)'

export function opensAsSheet() {
  return typeof window !== 'undefined' && !!window.matchMedia?.(SHEET_QUERY).matches
}
