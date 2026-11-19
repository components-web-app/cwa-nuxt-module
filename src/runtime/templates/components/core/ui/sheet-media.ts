export const SHEET_QUERY = '(max-width: 639.98px)'

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function matches(query: string) {
  return typeof window !== 'undefined' && !!window.matchMedia?.(query).matches
}

export function opensAsSheet() {
  return matches(SHEET_QUERY)
}

export function prefersReducedMotion() {
  return matches(REDUCED_MOTION_QUERY)
}
