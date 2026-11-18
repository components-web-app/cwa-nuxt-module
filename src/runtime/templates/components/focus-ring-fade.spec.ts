import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, test } from 'vitest'
import { fadesFocusRingFromText } from '../../../../test/utils/focus-ring'
import { fieldBox } from './core/ui/field-looks'

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      return sources(path)
    }
    return /\.(vue|ts)$/.test(entry.name) && !entry.name.endsWith('.spec.ts') ? [path] : []
  })
}

function classStrings(source: string) {
  return [...source.matchAll(/(['"`])((?:(?!\1)[^\n])*cwa:(?:(?!\1)[^\n])*)\1/g)].map(match => match[2]!.split(/\s+/).filter(Boolean))
}

describe('focus rings fade in from transparent, never from the text colour (#461)', () => {
  test('a field\'s focus ring has a transparent resting colour, so its colour transition never starts from white', () => {
    expect(fadesFocusRingFromText(fieldBox.split(' '))).toBe(false)
    expect(fadesFocusRingFromText(fieldBox.split(' ').filter(name => name !== 'cwa:outline-transparent'))).toBe(true)
  })

  test('no kit or admin control animates its focus ring\'s colour from the text colour', () => {
    const root = import.meta.dirname
    const offenders = sources(root).flatMap(file => classStrings(readFileSync(file, 'utf8'))
      .filter(fadesFocusRingFromText)
      .map(classes => `${relative(root, file)}: ${classes.filter(name => /transition|outline/.test(name)).join(' ')}`))

    expect(offenders).toEqual([])
  })
})
