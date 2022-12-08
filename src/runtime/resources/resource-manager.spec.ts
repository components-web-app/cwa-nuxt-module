import { describe, test, expect } from 'vitest'
import { ResourceManager } from './resource-manager'

describe('ResourceManager class tests', () => {
  test('Initial test', () => {
    const resourceManager = new ResourceManager()
    expect(resourceManager).toBe(resourceManager)
  })
})
