import { describe, test, expect } from 'vitest'
import { useProcess } from '#cwa/runtime/composables/process'

describe('process composable', () => {
  test('should return correct values for client/server flags IF env is client-side', () => {
    import.meta.client = true
    import.meta.server = false

    expect(useProcess()).toEqual({
      isClient: true,
      isServer: false,
    })
  })

  // Disabled due to @nuxt/test-utils bug - track issue and progress here https://github.com/danielroe/nuxt-vitest/issues/162 and here https://github.com/nuxt/test-utils/issues/531
  test.todo('should return correct values for client/server flags IF env is server-side', () => {
    import.meta.client = false
    import.meta.server = true

    expect(useProcess()).toEqual({
      isClient: false,
      isServer: true,
    })
  })
})
