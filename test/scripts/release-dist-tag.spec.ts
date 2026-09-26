import { describe, expect, test } from 'vitest'
import { distTagFor } from '../../scripts/release-dist-tag.mjs'

describe('distTagFor', () => {
  test('a stable version is published as latest', () => {
    expect(distTagFor('2.0.0', ['2.0.0-alpha.1', '2.0.0-alpha.2'])).toBe('latest')
  })

  test('a pre-release is published as latest while no stable version exists', () => {
    expect(distTagFor('2.0.0-alpha.3', ['2.0.0-alpha.1', '2.0.0-alpha.2'])).toBe('latest')
    expect(distTagFor('2.0.0-beta.1', [])).toBe('latest')
  })

  test('once a stable version exists, a pre-release goes under its own tag and leaves latest alone', () => {
    expect(distTagFor('2.1.0-alpha.1', ['2.0.0-alpha.2', '2.0.0'])).toBe('alpha')
    expect(distTagFor('3.0.0-rc.2', ['2.0.0'])).toBe('rc')
  })
})
