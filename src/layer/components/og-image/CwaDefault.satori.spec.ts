// @vitest-environment nuxt
import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import CwaDefault from './CwaDefault.satori.vue'

describe('CwaDefault OG image', () => {
  test('colours the logo with a fill attribute, because satori drops a fill set in the svg style', () => {
    const svg = mount(CwaDefault).find('svg')
    expect(svg.attributes('fill')).toBe('white')
    expect(svg.attributes('style') ?? '').not.toContain('fill')
  })
})
