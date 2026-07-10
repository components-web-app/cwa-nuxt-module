// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { mergeSelectedStyles, deriveSelectedStyles } from '#cwa/composables/cwa-styles'

const classes = {
  Bordered: ['border', 'border-gray-200'],
  Rounded: ['rounded'],
  Shadow: ['shadow-xl'],
}

describe('mergeSelectedStyles', () => {
  test('a single selected style → one joined entry', () => {
    expect(mergeSelectedStyles(['Rounded'], classes)).toEqual(['rounded'])
    expect(mergeSelectedStyles(['Bordered'], classes)).toEqual(['border border-gray-200'])
  })

  test('multiple styles → one joined entry each, in declaration order (not selection order)', () => {
    expect(mergeSelectedStyles(['Rounded', 'Bordered'], classes)).toEqual(['border border-gray-200', 'rounded'])
  })

  test('a class shared by two styles is not duplicated across entries', () => {
    const overlapping = { A: ['rounded'], B: ['rounded', 'shadow-xl'] }
    expect(mergeSelectedStyles(['A', 'B'], overlapping)).toEqual(['rounded', 'rounded shadow-xl'])
  })

  test('nothing selected → empty array', () => {
    expect(mergeSelectedStyles([], classes)).toEqual([])
  })

  test('unknown style names are ignored', () => {
    expect(mergeSelectedStyles(['Nope'], classes)).toEqual([])
  })
})

describe('deriveSelectedStyles', () => {
  test('exact joined-string match → selected, in declaration order', () => {
    expect(deriveSelectedStyles(['border border-gray-200', 'rounded'], classes)).toEqual(['Bordered', 'Rounded'])
  })

  test('a partially-present class list does NOT select the style (exact match only)', () => {
    expect(deriveSelectedStyles(['border'], classes)).toEqual([])
  })

  test('undefined / null / empty → empty array', () => {
    expect(deriveSelectedStyles(undefined, classes)).toEqual([])
    expect(deriveSelectedStyles(null, classes)).toEqual([])
    expect(deriveSelectedStyles([], classes)).toEqual([])
  })

  test('round-trips with mergeSelectedStyles', () => {
    const merged = mergeSelectedStyles(['Shadow', 'Bordered'], classes)
    expect(deriveSelectedStyles(merged, classes)).toEqual(['Bordered', 'Shadow']) // declaration order
  })
})
