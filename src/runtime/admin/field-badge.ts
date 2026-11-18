import type { CwaFieldState } from '#cwa/storage/stores/resources/state'

export interface FieldBadge {
  kind: 'conflict' | 'error' | undefined
  conflicts: number
  errors: number
}

export function badgeFor(states: (CwaFieldState | undefined)[]): FieldBadge {
  const conflicts = states.filter(state => state?.status === 'conflict').length
  const errors = states.filter(state => state?.status === 'error').length
  return { kind: conflicts ? 'conflict' : errors ? 'error' : undefined, conflicts, errors }
}

function count(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

export function badgeWords({ conflicts, errors }: FieldBadge) {
  return [
    conflicts ? `${count(conflicts, 'conflict')} to resolve` : '',
    errors ? `${errors} not saved` : '',
  ].filter(Boolean).join(', ')
}

export function issueText({ conflicts, errors }: FieldBadge) {
  return [conflicts ? count(conflicts, 'conflict') : '', errors ? `${errors} not saved` : ''].filter(Boolean).join(' · ')
}

export function issueShort({ conflicts, errors }: FieldBadge) {
  if (conflicts && errors) {
    return count(conflicts + errors, 'issue')
  }
  return conflicts ? count(conflicts, 'conflict') : `${errors} not saved`
}
