// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { useTransitions } from '#cwa/composables/transitions'

describe('useTransitions', () => {
  test('returns a transitions object with a context key', () => {
    const transitions = useTransitions()
    expect(transitions).toHaveProperty('context')
  })

  test('context transition has all required CSS class keys', () => {
    const { context } = useTransitions()
    expect(context).toHaveProperty('enterActiveClass')
    expect(context).toHaveProperty('enterFromClass')
    expect(context).toHaveProperty('enterToClass')
    expect(context).toHaveProperty('leaveActiveClass')
    expect(context).toHaveProperty('leaveFromClass')
    expect(context).toHaveProperty('leaveToClass')
  })

  test('context classes are non-empty strings', () => {
    const { context } = useTransitions()
    for (const value of Object.values(context)) {
      expect(typeof value).toBe('string')
      expect(value.length).toBeGreaterThan(0)
    }
  })

  test('returns a new object on each call', () => {
    const a = useTransitions()
    const b = useTransitions()
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
  })

  const newKeys = ['dropdown', 'overlay', 'slideUp', 'menu', 'spinner', 'notification', 'progressBar'] as const
  const requiredProps = ['enterActiveClass', 'enterFromClass', 'enterToClass', 'leaveActiveClass', 'leaveFromClass', 'leaveToClass']

  for (const key of newKeys) {
    test(`returns a transitions object with a ${key} key`, () => {
      expect(useTransitions()).toHaveProperty(key)
    })

    test(`${key} transition has all required CSS class keys`, () => {
      const transition = useTransitions()[key]
      for (const prop of requiredProps) {
        expect(transition).toHaveProperty(prop)
      }
    })

    test(`${key} classes are non-empty strings`, () => {
      const transition = useTransitions()[key]
      for (const value of Object.values(transition)) {
        expect(typeof value).toBe('string')
        expect(value.length).toBeGreaterThan(0)
      }
    })
  }
})
