import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const css = readFileSync(resolve(import.meta.dirname, '../../src/runtime/templates/assets/cwa.css'), 'utf8')

function ruleBody(name: string) {
  const selector = `.${name.replace(/[^\w-]/g, character => `\\${character}`)}`
  const start = css.indexOf(`${selector} {`)
  return start === -1 ? '' : css.slice(start, css.indexOf('}', start))
}

export function drawsFocusRing(classes: string[]) {
  return classes.includes('cwa:focus-visible:outline-2')
    && !classes.some(name => /outline-style:\s*none/.test(ruleBody(name)))
}
