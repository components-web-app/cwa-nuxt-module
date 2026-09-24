import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, test } from 'vitest'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))

const tempDirs: string[] = []

afterEach(() => {
  let dir = tempDirs.pop()
  while (dir) {
    rmSync(dir, { recursive: true, force: true })
    dir = tempDirs.pop()
  }
})

function installPublishedPackage() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'cwa-layer-export-')))
  tempDirs.push(root)

  const published = join(root, 'published')
  const app = join(root, 'app')
  mkdirSync(join(app, 'node_modules', dirname(pkg.name)), { recursive: true })
  writeFileSync(join(app, 'nuxt.config.ts'), '')

  for (const target of Object.values(pkg.exports as Record<string, string | Record<string, string>>)) {
    const files = typeof target === 'string' ? [target] : Object.values(target)
    for (const file of files) {
      mkdirSync(dirname(join(published, file)), { recursive: true })
      writeFileSync(join(published, file), '')
    }
  }
  writeFileSync(join(published, 'package.json'), JSON.stringify({ name: pkg.name, type: pkg.type, exports: pkg.exports }))

  symlinkSync(published, join(app, 'node_modules', pkg.name), 'dir')

  return { app, published }
}

describe('the layer is published as a bare specifier subpath', () => {
  test('the ./layer export points at the layer config the build copies into dist', () => {
    expect(pkg.exports['./layer']).toBe('./dist/layer/nuxt.config.ts')
    expect(existsSync(join(repoRoot, 'src/layer/nuxt.config.ts'))).toBe(true)
  })

  test('@cwa/nuxt/layer resolves to the layer config, through the real path of a symlinked install', () => {
    const { app, published } = installPublishedPackage()

    const resolved = createRequire(join(app, 'nuxt.config.ts')).resolve(`${pkg.name}/layer`)

    expect(resolved).toBe(join(published, 'dist/layer/nuxt.config.ts'))
    expect(resolved).not.toContain('node_modules')
  })
})
