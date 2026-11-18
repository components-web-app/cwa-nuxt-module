// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { parse } from '@vue/compiler-sfc'
import postcss from 'postcss'
import type { AtRule, Rule } from 'postcss'

const source = readFileSync(fileURLToPath(new URL('./HotSpot.vue', import.meta.url)), 'utf8')
const css = parse(source).descriptor.styles.map(style => style.content).join('\n')
const root = postcss.parse(css)

function declarationsIn(scope: postcss.Container, pseudo: 'before' | 'after') {
  const found: Record<string, string> = {}
  scope.walkRules((rule: Rule) => {
    if (scope === root && rule.parent?.type === 'atrule') {
      return
    }
    const selector = rule.selector.replace(/\s+/g, '')
    const parent = rule.parent && 'selector' in rule.parent ? (rule.parent as Rule).selector.replace(/\s+/g, '') : ''
    const full = selector.startsWith('&') ? parent + selector.slice(1) : selector
    if (full === `.cwa\\:hot-spot:${pseudo}` || full === `.cwa\\:hot-spot::${pseudo}`) {
      rule.walkDecls((declaration) => {
        found[declaration.prop] = declaration.value
      })
    }
  })
  return found
}

function reducedMotion() {
  const rules: AtRule[] = []
  root.walkAtRules('media', (rule) => {
    if (/prefers-reduced-motion:\s*reduce/.test(rule.params)) {
      rules.push(rule)
    }
  })
  return rules
}

describe('the hot spot', () => {
  test.each(['before', 'after'] as const)('pulses its %s ring with motion allowed', (pseudo) => {
    expect(declarationsIn(root, pseudo).animation).toMatch(/infinite/)
  })

  test.each(['before', 'after'] as const)('with reduced motion its %s ring does not move but still shows', (pseudo) => {
    const media = reducedMotion()
    expect(media.length).toBeGreaterThan(0)
    const reduced = Object.assign({}, ...media.map(rule => declarationsIn(rule, pseudo)))
    expect(reduced.animation).toBe('none')
    expect(reduced.transform).toMatch(/^scale\(1\.[1-9]\d*\)$/)
  })
})
