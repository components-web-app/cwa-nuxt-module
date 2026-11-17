// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const compiled = readFileSync(fileURLToPath(new URL('../../../assets/cwa.css', import.meta.url)), 'utf8').replace(/\s+/g, ' ')

describe('Toast surface in the compiled cwa.css (#457)', () => {
  test('is the menu surface mixed 12% toward its tone at 85%, frosted, with a 3px tone start edge, and the plain menu surface where color-mix is unsupported', () => {
    expect(compiled).toContain('.cwa\\:toast { --cwa-toast-tone: var(--cwa-color-accent-fg); background: var(--cwa-color-surface-menu); @supports (color: color-mix(in lab, red, red)) { background: color-mix(in srgb, color-mix(in srgb, var(--cwa-color-surface-menu) 88%, var(--cwa-toast-tone)) 85%, transparent); } -webkit-backdrop-filter: blur(16px) saturate(1.5); backdrop-filter: blur(16px) saturate(1.5); box-shadow: var(--cwa-shadow-popover), inset 3px 0 0 var(--cwa-toast-tone);')
  })

  test.each([
    ['success', 'success'],
    ['warning', 'warning'],
    ['error', 'danger'],
  ])('a %s toast takes its tone from %s', (tone, token) => {
    expect(compiled).toContain(`.cwa\\:toast-${tone} { --cwa-toast-tone: var(--cwa-color-${token}); }`)
  })

  test('is solid and tinted where blur is unsupported or transparency is reduced', () => {
    const solid = 'background: var(--cwa-color-surface-menu); @supports (color: color-mix(in lab, red, red)) { background: color-mix(in srgb, var(--cwa-color-surface-menu) 88%, var(--cwa-toast-tone)); }'
    expect(compiled).toContain(`@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) { .cwa\\:toast { ${solid} } }`)
    expect(compiled).toContain(`@media (prefers-reduced-transparency: reduce) { .cwa\\:toast { ${solid} -webkit-backdrop-filter: none; backdrop-filter: none; } }`)
  })
})
