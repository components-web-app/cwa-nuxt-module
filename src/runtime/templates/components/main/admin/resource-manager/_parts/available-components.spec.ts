import { describe, expect, test } from 'vitest'
import { isComponentAllowedInGroup } from './available-components'

const open = { endpoint: '/component/open', explicitAllowOnly: false }
const restricted = { endpoint: '/component/restricted', explicitAllowOnly: true }

describe('isComponentAllowedInGroup', () => {
  describe('group is unrestricted (allowedComponents null/undefined)', () => {
    test('offers a normal component', () => {
      expect(isComponentAllowedInGroup(open, null)).toBe(true)
      expect(isComponentAllowedInGroup(open, undefined)).toBe(true)
    })

    test('hides an explicitAllowOnly component', () => {
      expect(isComponentAllowedInGroup(restricted, null)).toBe(false)
      expect(isComponentAllowedInGroup(restricted, undefined)).toBe(false)
    })
  })

  describe('group restricts via allowedComponents', () => {
    test('offers a component whose endpoint is listed — even an explicitAllowOnly one', () => {
      expect(isComponentAllowedInGroup(restricted, ['/component/restricted'])).toBe(true)
      expect(isComponentAllowedInGroup(open, ['/component/open'])).toBe(true)
    })

    test('hides a component whose endpoint is not listed', () => {
      expect(isComponentAllowedInGroup(open, ['/component/restricted'])).toBe(false)
      expect(isComponentAllowedInGroup(restricted, ['/component/open'])).toBe(false)
    })

    test('an empty allowedComponents list is still a restriction — nothing is offered', () => {
      expect(isComponentAllowedInGroup(open, [])).toBe(false)
      expect(isComponentAllowedInGroup(restricted, [])).toBe(false)
    })
  })
})
