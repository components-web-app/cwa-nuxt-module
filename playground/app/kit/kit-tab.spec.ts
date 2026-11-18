import { describe, expect, test } from 'vitest'
import { kitTabOf } from './kit-tab'

describe('the /kit tabs are bookmarkable through ?tab=', () => {
  test('?tab=practice opens In practice; anything else, or nothing, opens the kit', () => {
    expect(kitTabOf('practice')).toBe('practice')
    expect(kitTabOf(undefined)).toBe('kit')
    expect(kitTabOf('nonsense')).toBe('kit')
    expect(kitTabOf(['practice'])).toBe('kit')
  })
})
