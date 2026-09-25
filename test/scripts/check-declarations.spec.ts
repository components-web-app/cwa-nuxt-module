import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { findEmptyDeclarations } from '../../scripts/check-declarations.mjs'

describe('findEmptyDeclarations', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cwa-declarations-'))
    mkdirSync(join(dir, 'runtime', 'admin'), { recursive: true })
    writeFileSync(join(dir, 'module.d.mts'), 'export {}')
    writeFileSync(join(dir, 'runtime', 'admin', 'Modal.vue.d.ts'), 'declare const _default: any')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  test('finds nothing when every declaration has content', () => {
    expect(findEmptyDeclarations(dir)).toEqual([])
  })

  test('finds empty declarations of every shape the build emits, in nested directories', () => {
    for (const file of ['Tabs.vue.d.ts', 'Tabs.d.vue.ts', 'util.d.ts', 'module.d.cts']) {
      writeFileSync(join(dir, 'runtime', 'admin', file), '')
    }

    expect(findEmptyDeclarations(dir).sort()).toEqual([
      join('runtime', 'admin', 'Tabs.d.vue.ts'),
      join('runtime', 'admin', 'Tabs.vue.d.ts'),
      join('runtime', 'admin', 'module.d.cts'),
      join('runtime', 'admin', 'util.d.ts'),
    ])
  })

  test('ignores empty files that are not declarations', () => {
    writeFileSync(join(dir, 'runtime', 'admin', 'empty.mjs'), '')
    writeFileSync(join(dir, 'runtime', 'admin', 'placeholder.vue'), '')

    expect(findEmptyDeclarations(dir)).toEqual([])
  })
})
