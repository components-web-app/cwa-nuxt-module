import { vi, describe, test, expect } from 'vitest'
import * as nuxt from 'nuxt/config'

describe('defineNuxtConfig called with correct object', () => {
  test('Config is correct', async () => {
    vi.spyOn(nuxt, 'defineNuxtConfig').mockImplementationOnce(() => {})
    await import('./nuxt.config')
    expect(nuxt.defineNuxtConfig).toHaveBeenCalledWith({})
  })
})
