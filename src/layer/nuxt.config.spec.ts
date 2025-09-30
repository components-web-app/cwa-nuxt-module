import type * as nuxtKit from '@nuxt/kit'
import { vi, describe, test, expect } from 'vitest'
import * as nuxt from 'nuxt/config'

vi.mock('node:url', async () => {
  const actual = await vi.importActual<typeof nuxtKit>('@nuxt/kit')

  const newModule = {
    ...actual,
    fileURLToPath: vi.fn().mockReturnValue('mock-module-url'),
  }

  return {
    ...newModule,
    default: newModule,
  }
})

describe('defineNuxtConfig called with correct object', () => {
  test('Config is correct', async () => {
    vi.spyOn(nuxt, 'defineNuxtConfig').mockImplementationOnce(() => {})
    await import('./nuxt.config')
    expect(nuxt.defineNuxtConfig).toHaveBeenCalledWith({
      modules: [
        'mock-module-url',
      ],
    })
  })
})
