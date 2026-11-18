import { describe, expect, test } from 'vitest'
import { badgeFor, badgeWords, issueShort, issueText } from './field-badge'
import type { CwaFieldState } from '#cwa/storage/stores/resources/state'

const of = (status: CwaFieldState['status']): CwaFieldState => ({ status, waiting: false, slow: false })

describe('field badge (#459)', () => {
  test('a conflict outranks an error, and saving or saved fields count for neither', () => {
    expect(badgeFor([of('error'), of('conflict'), of('saving')])).toEqual({ kind: 'conflict', conflicts: 1, errors: 1 })
    expect(badgeFor([of('error'), of('saved')])).toEqual({ kind: 'error', conflicts: 0, errors: 1 })
    expect(badgeFor([of('saving'), undefined])).toEqual({ kind: undefined, conflicts: 0, errors: 0 })
  })

  test.each([
    [{ kind: 'conflict', conflicts: 1, errors: 1 }, '1 conflict to resolve, 1 not saved', '1 conflict · 1 not saved', '2 issues'],
    [{ kind: 'conflict', conflicts: 2, errors: 0 }, '2 conflicts to resolve', '2 conflicts', '2 conflicts'],
    [{ kind: 'error', conflicts: 0, errors: 3 }, '3 not saved', '3 not saved', '3 not saved'],
  ] as const)('%o reads "%s", "%s" and, short, "%s"', (badge, words, text, short) => {
    expect(badgeWords(badge)).toBe(words)
    expect(issueText(badge)).toBe(text)
    expect(issueShort(badge)).toBe(short)
  })
})
