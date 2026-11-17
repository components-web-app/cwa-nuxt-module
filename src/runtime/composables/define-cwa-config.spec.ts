// @vitest-environment nuxt
import { describe, expect, test } from 'vitest'
import { defineCwaConfig } from '#imports'

describe('defineCwaConfig', () => {
  test('is auto-imported and returns nothing at runtime', () => {
    expect(defineCwaConfig({
      name: 'Hero',
      styles: { 'black-bg': { label: 'Black Background', classes: 'bg-black text-white' } },
    })).toBeUndefined()
  })
})
