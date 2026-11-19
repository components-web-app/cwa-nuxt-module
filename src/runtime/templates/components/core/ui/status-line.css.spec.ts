// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const compiled = readFileSync(fileURLToPath(new URL('../../../assets/cwa.css', import.meta.url)), 'utf8').replace(/\s+/g, ' ')

function declarations(selector: string) {
  const start = compiled.indexOf(`${selector} {`)
  expect(start).toBeGreaterThan(-1)
  return compiled.slice(start + selector.length + 2, compiled.indexOf('}', start))
}

describe('a field\'s saved line in the compiled cwa.css (#461)', () => {
  test('rests hidden, so its last frame needs no fill', () => {
    expect(compiled).toContain('.cwa\\:status-line::before, .cwa\\:status-line::after { content: \'\'; position: absolute; inset: 0; opacity: 0; }')
    expect(compiled).toMatch(/@keyframes cwa-line-saved \{.*?100% \{ clip-path: inset\(0\); opacity: 0; \} \}/)
  })

  test('plays its clip-path sweep once and keeps no finished animation filling it, which crashed Chromium 156 when a modal\'s scroll lock was released', () => {
    const animation = declarations('.cwa\\:status-line[data-line=\'saved\']::before').match(/animation: ([^;]+);/)?.[1]
    expect(animation).toBe('cwa-line-saved 1.18s ease-out')
  })
})
