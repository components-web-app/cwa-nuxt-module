import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const css = readFileSync(resolve(import.meta.dirname, '../../src/runtime/templates/assets/cwa.css'), 'utf8')

interface Rule { selector: string, body: string, order: number, specificity: number }

function specificity(selector: string) {
  const bare = selector.replace(/\\./g, '').replace(/::[\w-]+/g, '').replace(/:(?:is|where|not)\(/g, '(')
  return (bare.match(/#/g)?.length ?? 0) * 100 + (bare.match(/[.[:]/g)?.length ?? 0) * 10
}

const rules: Rule[] = [...css.matchAll(/^([.:\w[][^{}\n]*?) \{\n([^{}]*)\}/gm)]
  .map(([, selector, body], order) => ({ selector: selector!, body: body!, order, specificity: specificity(selector!) }))

function matches(element: Element, selector: string) {
  const group = /^(.+?):is\((.+) \*\)$/.exec(selector)
  try {
    return element.matches(group ? `${group[2]} ${group[1]}` : selector)
  }
  catch {
    return false
  }
}

function winning(element: Element, property: 'color' | 'background-color') {
  const pattern = new RegExp(`(?:^|\\s)${property}: var\\(--cwa-color-([\\w-]+)\\);`)
  return rules
    .filter(rule => pattern.test(rule.body) && matches(element, rule.selector))
    .sort((a, b) => b.specificity - a.specificity || b.order - a.order)
    .map(rule => pattern.exec(rule.body)![1]!)[0]
}

export function shownColour(element: Element): string | undefined {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const colour = winning(node, 'color')
    if (colour) {
      return colour
    }
  }
  return undefined
}

export function shownFill(element: Element): string | undefined {
  return winning(element, 'background-color')
}

export function fillsOnHover(element: Element) {
  return [...element.classList].some(name => /^cwa:hover:bg-/.test(name))
}

function openRules(element: Element) {
  if (element.getAttribute('aria-expanded') !== 'true') {
    return []
  }
  return [element, ...element.querySelectorAll('*')].flatMap(node => rules.filter(rule => rule.selector.includes('[aria-expanded="true"]') && matches(node, rule.selector)))
}

export function drawsOpenState(element: Element) {
  return openRules(element).some(rule => /(?:^|\s)(?:color|background-color|box-shadow):/.test(rule.body))
}

export function drawsOpenLine(element: Element) {
  return openRules(element).some(rule => rule.selector.startsWith('.cwa\\:aria-expanded\\:shadow-\\[inset_0_-2px_0_currentColor\\]') && /box-shadow:/.test(rule.body))
}

export function trimsToLetters(element: Element) {
  const rule = css.slice(css.indexOf('.cwa\\:trim-text {'))
  return element.classList.contains('cwa:trim-text')
    && /^\.cwa\\:trim-text \{\s*text-box: trim-both cap alphabetic;/.test(rule)
}
