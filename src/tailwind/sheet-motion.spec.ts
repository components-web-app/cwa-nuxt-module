import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const css = readFileSync(resolve(import.meta.dirname, '../runtime/templates/assets/cwa.css'), 'utf8')

function keyframe(name: string, edge: 'from' | 'to') {
  const keyframes = new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n\\}`).exec(css)?.[1]
  return new RegExp(`${edge} \\{\\s*([^}]*?)\\s*\\}`).exec(keyframes ?? '')?.[1]
}

function animationRule(name: string) {
  const at = css.indexOf(`animation: ${name} `)
  const media = css.lastIndexOf('@media', at)
  return { declaration: css.slice(at, css.indexOf(';', at)), media: css.slice(media, css.indexOf('{', media)) }
}

describe('a phone bottom sheet slides in from wholly below the screen and back out (#461)', () => {
  test('it starts wholly below the screen and ends there', () => {
    expect(keyframe('cwa-sheet-in', 'from')).toBe('translate: 0 100%;')
    expect(keyframe('cwa-sheet-out', 'to')).toBe('translate: 0 100%;')
  })

  test.each(['cwa-sheet-in', 'cwa-sheet-out'])('%s runs over the slow duration, only with motion allowed', (name) => {
    const { declaration, media } = animationRule(name)
    expect(declaration).toContain('var(--cwa-duration-slow)')
    expect(media).toContain('prefers-reduced-motion: no-preference')
  })
})
