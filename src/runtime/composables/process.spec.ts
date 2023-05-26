import { describe, test, expect } from 'vitest'
import { useProcess } from '#cwa/runtime/composables/process'

describe('process composable', () => {
  test('should return correct values for client/server flags IF env is client-side', () => {
    process.client = true
    process.server = false

    expect(useProcess()).toEqual({
      isClient: true,
      isServer: false
    })
  })

  test.todo('should return correct values for client/server flags IF env is server-side', () => {
    process.client = false
    process.server = true

    expect(useProcess()).toEqual({
      isClient: false,
      isServer: true
    })
  })
})
