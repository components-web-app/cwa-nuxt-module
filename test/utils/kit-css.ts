import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const css = readFileSync(resolve(import.meta.dirname, '../../src/runtime/templates/assets/cwa.css'), 'utf8')

function compiledForOpen(name: string) {
  const selector = `.${name.replace(/[^\w-]/g, character => `\\${character}`)}[aria-expanded="true"] {`
  const start = css.indexOf(selector)
  return start === -1 ? '' : css.slice(start, css.indexOf('}', start))
}

export function openStateClasses(element: Element) {
  return [...element.classList].filter(name => /^cwa:aria-expanded:/.test(name) && /(?:background-color|box-shadow):/.test(compiledForOpen(name)))
}

export function drawsOpenState(element: Element) {
  const classes = openStateClasses(element)
  return element.getAttribute('aria-expanded') === 'true'
    && classes.some(name => /^cwa:aria-expanded:shadow-\[inset_0_-2px_0_currentColor]$/.test(name))
    && classes.some(name => /^cwa:aria-expanded:bg-/.test(name))
}

export function trimsToLetters(element: Element) {
  const rule = css.slice(css.indexOf('.cwa\\:trim-text {'))
  return element.classList.contains('cwa:trim-text')
    && /^\.cwa\\:trim-text \{\s*text-box: trim-both cap alphabetic;/.test(rule)
}
