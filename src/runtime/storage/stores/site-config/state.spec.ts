// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import state from './state'

describe('site-config store state', () => {
  test('returns fresh state with correct defaults', () => {
    const s = state()
    expect(s.isLoading.value).toBe(false)
    expect(s.config.value).toEqual({})
    expect(s.serverConfig.value).toBeUndefined()
  })

  test('each call returns independent state instances', () => {
    const a = state()
    const b = state()
    a.config.value = { siteName: 'A' }
    expect(b.config.value).toEqual({})
  })
})
