import { describe, expect, test } from 'vitest'
import { canInsertSelection } from './add-component-selection'

describe('canInsertSelection', () => {
  test('disabled when nothing is selected', () => {
    expect(canInsertSelection(undefined, null, null)).toBe(false)
  })

  test('enabled for a normal component regardless of dynamic selection', () => {
    expect(canInsertSelection('Html', null, null)).toBe(true)
    expect(canInsertSelection('Html', 'App\\Entity\\EventData', 'heroImage')).toBe(true)
  })

  describe('dynamic ComponentPosition', () => {
    test('disabled until both a data type and a field are chosen', () => {
      expect(canInsertSelection('ComponentPosition', null, null)).toBe(false)
      expect(canInsertSelection('ComponentPosition', 'App\\Entity\\EventData', null)).toBe(false)
      expect(canInsertSelection('ComponentPosition', null, 'heroImage')).toBe(false)
    })

    test('enabled once both a data type and a field are chosen', () => {
      expect(canInsertSelection('ComponentPosition', 'App\\Entity\\EventData', 'heroImage')).toBe(true)
    })
  })
})
