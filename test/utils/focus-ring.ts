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

const focusOutlineColour = /^cwa:(?:[\w-]+:)*focus(?:-visible|-within)?:outline-(?!\d|offset|none|hidden|solid|dashed|dotted|double|-)/

function animatesOutlineColour(name: string) {
  const body = ruleBody(name)
  return /transition-property:[^;]*(?:outline-color|\ball\b)/.test(body)
}

function setsRestingOutlineColour(name: string) {
  return /^cwa:outline-/.test(name) && /outline-color:/.test(ruleBody(name))
}

export function fadesFocusRingFromText(classes: string[]) {
  return classes.some(name => focusOutlineColour.test(name))
    && classes.some(animatesOutlineColour)
    && !classes.some(setsRestingOutlineColour)
}
