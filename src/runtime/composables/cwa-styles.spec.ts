// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { mergeSelectedStyles, deriveSelectedStyles, toClassString } from '#cwa/composables/cwa-styles'

const classes = {
  Bordered: 'border border-gray-200',
  Rounded: 'rounded',
  Shadow: 'shadow-xl',
}

describe('toClassString', () => {
  test('returns a string as-is', () => {
    expect(toClassString('border rounded')).toBe('border rounded')
  })
  test('joins an array with spaces', () => {
    expect(toClassString(['border', 'rounded'])).toBe('border rounded')
  })
})

describe('mergeSelectedStyles', () => {
  test('a single selected style → one entry', () => {
    expect(mergeSelectedStyles(['Rounded'], classes)).toEqual(['rounded'])
    expect(mergeSelectedStyles(['Bordered'], classes)).toEqual(['border border-gray-200'])
  })

  test('multiple styles → one entry each, in declaration order (not selection order)', () => {
    expect(mergeSelectedStyles(['Rounded', 'Bordered'], classes)).toEqual(['border border-gray-200', 'rounded'])
  })

  test('array style values are normalised (joined) to one entry', () => {
    const arrayClasses = { Bordered: ['border', 'border-gray-200'], Rounded: ['rounded'] }
    expect(mergeSelectedStyles(['Bordered', 'Rounded'], arrayClasses)).toEqual(['border border-gray-200', 'rounded'])
  })

  test('nothing selected → empty array', () => {
    expect(mergeSelectedStyles([], classes)).toEqual([])
  })

  test('unknown style names are ignored', () => {
    expect(mergeSelectedStyles(['Nope'], classes)).toEqual([])
  })
})

describe('deriveSelectedStyles', () => {
  test('exact class-string match → selected, in declaration order', () => {
    expect(deriveSelectedStyles(['border border-gray-200', 'rounded'], classes)).toEqual(['Bordered', 'Rounded'])
  })

  test('a partial class string does NOT select the style (exact match only)', () => {
    expect(deriveSelectedStyles(['border'], classes)).toEqual([])
  })

  test('matches array-declared styles by their joined string', () => {
    const arrayClasses = { Bordered: ['border', 'border-gray-200'] }
    expect(deriveSelectedStyles(['border border-gray-200'], arrayClasses)).toEqual(['Bordered'])
  })

  test('undefined / null / empty → empty array', () => {
    expect(deriveSelectedStyles(undefined, classes)).toEqual([])
    expect(deriveSelectedStyles(null, classes)).toEqual([])
    expect(deriveSelectedStyles([], classes)).toEqual([])
  })

  test('round-trips with mergeSelectedStyles (single and multiple)', () => {
    expect(deriveSelectedStyles(mergeSelectedStyles(['Rounded'], classes), classes)).toEqual(['Rounded'])
    const merged = mergeSelectedStyles(['Shadow', 'Bordered'], classes)
    expect(deriveSelectedStyles(merged, classes)).toEqual(['Bordered', 'Shadow']) // declaration order
  })
})
