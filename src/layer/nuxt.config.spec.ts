import type * as nuxtKit from '@nuxt/kit'
import { join } from 'path'
import { vi, describe, test, expect } from 'vitest'
import * as nuxt from 'nuxt/config'

vi.mock('@nuxt/kit', async () => {
  const actual = await vi.importActual<typeof nuxtKit>('@nuxt/kit')

  const newModule = {
    ...actual,
    createResolver: vi.fn().mockReturnValue({ resolvePath: vi.fn(), resolve: vi.fn(function (...args) { return join(...args) }) }),
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
        '../module',
      ],
    })
  })
})
