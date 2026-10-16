import { describe, expect, test } from 'vitest'
import { componentGroupCapacity } from './component-group-capacity'

describe('componentGroupCapacity (#398)', () => {
  test.each([
    ['no limit', { componentPositions: ['/p1', '/p2'] }, { max: null, count: 2, full: false, over: false }],
    ['a null limit', { maxComponents: null, componentPositions: ['/p1'] }, { max: null, count: 1, full: false, over: false }],
    ['a count below the limit', { maxComponents: 2, componentPositions: ['/p1'] }, { max: 2, count: 1, full: false, over: false }],
    ['a count equal to the limit', { maxComponents: 1, componentPositions: ['/p1'] }, { max: 1, count: 1, full: true, over: false }],
    ['a count above the limit', { maxComponents: 1, componentPositions: ['/p1', '/p2', '/p3'] }, { max: 1, count: 3, full: true, over: true }],
    ['a limit with no positions key', { maxComponents: 1 }, { max: 1, count: 0, full: false, over: false }],
  ])('%s', (_label, data, expected) => {
    expect(componentGroupCapacity(data)).toEqual(expected)
  })

  test('no group data has no limit', () => {
    expect(componentGroupCapacity(undefined)).toEqual({ max: null, count: 0, full: false, over: false })
  })
})
