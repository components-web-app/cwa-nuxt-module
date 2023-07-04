import { vi, describe, test, expect } from 'vitest'
import * as nuxt from '#app'
import { useCwa } from '#cwa/runtime/composables/cwa'

describe('CWA composable', () => {
  test('should return $cwa', () => {
    const mockCwa = { test: true }

    vi.spyOn(nuxt, 'useNuxtApp').mockImplementation(() => {
      return {
        $cwa: mockCwa
      }
    })

    expect(useCwa()).toEqual(mockCwa)
  })
})
