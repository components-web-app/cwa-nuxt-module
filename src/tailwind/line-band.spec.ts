import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const css = readFileSync(resolve(import.meta.dirname, '../runtime/templates/assets/cwa.css'), 'utf8')

function keyframePosition(edge: 'from' | 'to') {
  const keyframes = /@keyframes cwa-line-band \{([\s\S]*?)\n\}/.exec(css)![1]!
  return Number(new RegExp(`${edge} \\{\\s*background-position: (-?[\\d.]+)%`).exec(keyframes)![1]) / 100
}

const bands = [...css.matchAll(/^\s*([^{}\n]+?) \{\n([^{}]*animation: cwa-line-band[^{}]*)\}/gm)]
  .map(([, selector, body]) => ({ selector: selector!, size: Number(/background-size: ([\d.]+)%/.exec(body!)![1]) / 100 }))

describe('a band sweeping with cwa-line-band starts and ends wholly outside its box, so every repeat is seamless', () => {
  test('there are bands to check', () => {
    expect(bands.map(band => band.selector)).toEqual(expect.arrayContaining([expect.stringContaining('skeleton'), expect.stringContaining('dialog-edge')]))
  })

  test.each(bands)('$selector', ({ size }) => {
    const leftEdgeAt = (position: number) => position * (1 - size)
    expect(leftEdgeAt(keyframePosition('from')) + size).toBeLessThanOrEqual(0)
    expect(leftEdgeAt(keyframePosition('to'))).toBeGreaterThanOrEqual(1)
  })
})
