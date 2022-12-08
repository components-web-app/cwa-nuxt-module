import { describe, expect, test, beforeEach, vi } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { ApiDocumentationStore } from './api-documentation-store'

describe('ApiDocumentationStore tests', () => {
  beforeEach(() => {
    const pinia = createTestingPinia({
      createSpy: vi.fn
    })
    setActivePinia(pinia)
    vi.clearAllMocks()
  })

  test('Initial state', () => {
    const store = new ApiDocumentationStore('storeName')
    const storeDefinition = store.useStore()
    expect(storeDefinition.docsPath).toBeNull()
    expect(storeDefinition.$state).toStrictEqual({
      docsPath: null
    })
  })
})
