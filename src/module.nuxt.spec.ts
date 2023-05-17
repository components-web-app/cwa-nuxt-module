// @vitest-environment nuxt

import { setActivePinia, createPinia } from 'pinia'
import { describe, test, expect, beforeEach } from 'vitest'

describe('Dummy', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  test('Any old test', () => {
    expect(true).toBe(true)
  })
})
