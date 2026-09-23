// @vitest-environment node
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, test, expect } from 'vitest'

const pagesDir = fileURLToPath(new URL('./pages', import.meta.url))

function shippedFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return shippedFiles(path)
    }
    return entry.name.includes('.spec.') ? [] : [path.slice(pagesDir.length + 1)]
  })
}

describe('layer pages directory', () => {
  test('ships Vue components only, so a composable is never registered as a route', () => {
    expect(shippedFiles(pagesDir).filter(file => !file.endsWith('.vue'))).toEqual([])
  })
})
