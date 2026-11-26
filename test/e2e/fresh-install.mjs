import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../..')

const ROUNDS = process.argv.includes('--no-hoist-only')
  ? [{ name: 'no-hoist', hoist: false }]
  : [{ name: 'default install', hoist: true }, { name: 'no-hoist', hoist: false }]

const APP_FILES = {
  'package.json': JSON.stringify({
    name: 'cwa-fresh-install-check',
    private: true,
    type: 'module',
    dependencies: {
      '@cwa/nuxt': '',
      '@nuxt/kit': '^4.6.0',
      'nuxt': '^4.6.0',
      'vue': '^3.5.41',
    },
  }, undefined, 2),
  'nuxt.config.ts': `export default defineNuxtConfig({
  extends: ['@cwa/nuxt/layer'],
  modules: ['@cwa/nuxt', './extension/module'],
  runtimeConfig: {
    public: { cwa: { apiUrl: 'https://localhost/_api', apiUrlBrowser: 'https://localhost/_api' } },
  },
  typescript: { typeCheck: false },
})
`,
  'app/app.vue': `<template>
  <NuxtPage />
</template>
`,
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { stdio: 'pipe', encoding: 'utf8', ...options })
}

function pack(destination) {
  if (!existsSync(join(repoRoot, '.nuxt/tsconfig.json'))) {
    run('pnpm', ['run', 'dev:prepare'], { cwd: repoRoot, stdio: 'inherit' })
  }
  run('pnpm', ['pack', '--pack-destination', destination], { cwd: repoRoot })
  const tarball = readdirSync(destination).find(file => file.endsWith('.tgz'))
  if (!tarball) {
    throw new Error(`pnpm pack produced no tarball in ${destination}`)
  }
  return join(destination, tarball)
}

function minimumReleaseAgeExclude() {
  const workspace = readFileSync(join(repoRoot, 'pnpm-workspace.yaml'), 'utf8')
  const list = workspace.match(/^minimumReleaseAgeExclude:\n((?: {2}- .*\n)+)/m)
  return list ? `minimumReleaseAgeExclude:\n${list[1]}` : ''
}

function writeApp(appDir, tarball, hoist) {
  mkdirSync(join(appDir, 'app'), { recursive: true })
  for (const [file, contents] of Object.entries(APP_FILES)) {
    writeFileSync(join(appDir, file), file === 'package.json' ? contents.replace('"@cwa/nuxt": ""', `"@cwa/nuxt": "file:${tarball}"`) : contents)
  }
  cpSync(join(repoRoot, 'test/fixtures/cwa-extension'), join(appDir, 'extension'), { recursive: true })
  writeFileSync(join(appDir, 'pnpm-workspace.yaml'), `hoist: ${hoist}\nstrictDepBuilds: false\n${minimumReleaseAgeExclude()}`)
}

function build(appDir) {
  run('pnpm', ['install', '--no-frozen-lockfile'], { cwd: appDir })
  run('node', [join(appDir, 'node_modules/nuxt/bin/nuxt.mjs'), 'build'], { cwd: appDir })
}

function checkExtension(appDir) {
  const buildDir = [join(appDir, '.nuxt'), join(appDir, 'node_modules/.cache/nuxt/.nuxt')].find(dir => existsSync(join(dir, 'cwa-component-names.ts')))
  if (!buildDir) {
    throw new Error('the build wrote no cwa-component-names.ts')
  }
  const read = file => readFileSync(join(buildDir, file), 'utf8')
  if (!read('cwa-component-names.ts').includes('"FixtureBadge": "FixtureBadge"')) {
    throw new Error('the fixture extension\'s FixtureBadge component is not a CWA component name')
  }
  if (!/"segment": "fixture"[\s\S]*"path": "orders"/.test(read('cwa-extension-areas.ts'))) {
    throw new Error('the fixture extension\'s admin area is not listed')
  }
}

function report(label, error) {
  const output = `${error.stdout || ''}${error.stderr || ''}`.trim()
  console.error(`\n✗ ${label}\n`)
  console.error(output || error.message)
}

const workDir = mkdtempSync(join(tmpdir(), 'cwa-fresh-install-'))
let failed = false

try {
  const tarball = pack(workDir)

  for (const round of ROUNDS) {
    const appDir = join(workDir, round.name.replace(/\W+/g, '-'))
    mkdirSync(appDir, { recursive: true })
    writeApp(appDir, tarball, round.hoist)

    const started = Date.now()
    try {
      build(appDir)
      checkExtension(appDir)
      console.log(`✓ ${round.name}: installs and builds with no optional packages and an extension registered through cwa:extend (${Math.round((Date.now() - started) / 1000)}s)`)
    }
    catch (error) {
      failed = true
      report(`${round.name}: a fresh app could not install or build @cwa/nuxt`, error)
    }
  }
}
finally {
  rmSync(workDir, { recursive: true, force: true })
}

if (failed) {
  process.exit(1)
}

console.log('\nEvery shipped import resolves from a fresh install.')
console.log('`pnpm pack` rebuilt dist/ — run `pnpm run dev:prepare` to restore the stub build.')
