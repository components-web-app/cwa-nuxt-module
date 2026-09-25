import { describe, expect, test } from 'vitest'
import { extractChangelogSection } from '../../scripts/changelog-section.mjs'

const changelog = `# Changelog

## [Unreleased]

- Pending change ([abc1234](https://example.com/commit/abc1234))

## [2.0.0-alpha.2] - 2026-10-01

- Second change ([#400](https://example.com/pull/400))
- Third change

## [2.0.0-alpha.1] - 2026-09-24

- First tagged release

[Unreleased]: https://example.com/compare/v2.0.0-alpha.2...HEAD
[2.0.0-alpha.2]: https://example.com/compare/v2.0.0-alpha.1...v2.0.0-alpha.2
`

describe('extractChangelogSection', () => {
  test('returns the lines under the version heading, up to the next heading', () => {
    expect(extractChangelogSection(changelog, '2.0.0-alpha.2')).toBe('- Second change ([#400](https://example.com/pull/400))\n- Third change')
  })

  test('stops at the link references after the last section', () => {
    expect(extractChangelogSection(changelog, '2.0.0-alpha.1')).toBe('- First tagged release')
  })

  test('accepts a tag name with a leading v', () => {
    expect(extractChangelogSection(changelog, 'v2.0.0-alpha.1')).toBe('- First tagged release')
  })

  test('does not match a version that only shares a prefix', () => {
    expect(extractChangelogSection(changelog, '2.0.0-alpha')).toBeUndefined()
  })

  test('returns undefined for a version with no section', () => {
    expect(extractChangelogSection(changelog, '9.9.9')).toBeUndefined()
  })

  test('returns undefined for a section with no entries', () => {
    expect(extractChangelogSection('## [1.0.0] - 2026-01-01\n\n## [0.9.0]\n\n- old', '1.0.0')).toBeUndefined()
  })
})
