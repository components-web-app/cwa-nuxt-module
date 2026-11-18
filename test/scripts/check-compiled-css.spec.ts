// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { compiledCss, findStaleCompiledCss, staleMessage } from '../../scripts/check-compiled-css.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))
const base = compiledCss.find(({ script }) => script === 'tailwind:base')!

describe('the committed compiled CSS', () => {
  test('is what tailwind:main and tailwind:base compile from the source now', () => {
    const stale = findStaleCompiledCss(root)

    expect(stale, staleMessage(stale)).toEqual([])
  }, 60000)
})

describe('findStaleCompiledCss', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cwa-compiled-css-spec-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  test('reports a committed file that differs from a fresh compile, and the message names the script to run', () => {
    const committed = join(dir, 'base.css')
    writeFileSync(committed, `${readFileSync(join(root, base.committed), 'utf8')}.cwa\\:missing { color: red }\n`)
    const stale = findStaleCompiledCss(root, [{ ...base, committed }])

    expect(stale).toEqual([{ ...base, committed }])
    expect(staleMessage(stale)).toContain(`${committed}: run \`pnpm run tailwind:base\` and commit it`)
  }, 60000)

  test('passes a committed file equal to a fresh compile', () => {
    const committed = join(dir, 'base.css')
    writeFileSync(committed, readFileSync(join(root, base.committed), 'utf8'))

    expect(findStaleCompiledCss(root, [{ ...base, committed }])).toEqual([])
  }, 60000)
})
