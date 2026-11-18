import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, test } from 'vitest'

const root = join(import.meta.dirname, '..')
const scanned = ['src/runtime/templates/components', 'src/layer', 'src/tailwind', 'playground/app/pages/kit.vue']
const sources = /\.(?:vue|ts|css)$/
const dashed = /\b(?:dashed|dotted)\b|line-dash/

function filesUnder(path: string): string[] {
  if (!statSync(path).isDirectory()) {
    return [path]
  }
  return readdirSync(path).flatMap(entry => filesUnder(join(path, entry)))
}

function offences(file: string) {
  return readFileSync(file, 'utf8')
    .split('\n')
    .flatMap((line, index) => dashed.test(line) ? [`${relative(root, file)}:${index + 1}`] : [])
}

describe('the kit draws no dashed or dotted lines', () => {
  test('no kit, admin or layer source uses a dashed or dotted line, or the line-dash token', () => {
    const files = scanned
      .flatMap(path => filesUnder(join(root, path)))
      .filter(file => sources.test(file) && !file.endsWith('.spec.ts'))

    expect(files.length).toBeGreaterThan(0)
    expect(files.flatMap(offences)).toEqual([])
  })
})
