import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const container = process.env.REHEARSAL_PHP_CONTAINER || 'components-web-app-php-1'
const env = { ...process.env, REHEARSAL_MODE: 'record' }

function fromContainer(command) {
  try {
    return execFileSync('docker', ['exec', container, 'sh', '-c', command], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  }
  catch {
    return undefined
  }
}

if (!env.REHEARSAL_CA) {
  const ca = fromContainer('cat /data/caddy/pki/authorities/local/root.crt')
  if (ca) {
    const file = join(mkdtempSync(join(tmpdir(), 'cwa-rehearsal-')), 'caddy-root.crt')
    writeFileSync(file, ca)
    env.REHEARSAL_CA = file
  }
}

if (!env.REHEARSAL_BUNDLE) {
  const lock = fromContainer('cat composer.lock')
  const bundle = lock && JSON.parse(lock).packages.find(pkg => pkg.name === 'components-web-app/api-components-bundle')
  if (bundle) {
    env.REHEARSAL_BUNDLE = `${bundle.version} (${bundle.source?.reference?.slice(0, 8)})`
  }
}

console.log(`Rehearsing against ${env.REHEARSAL_API || 'https://localhost'}, api-components-bundle ${env.REHEARSAL_BUNDLE || 'unknown'}`)
const config = join(dirname(fileURLToPath(import.meta.url)), 'playwright.config.mjs')
const result = spawnSync('pnpm', ['exec', 'playwright', 'test', '-c', config, ...process.argv.slice(2)], { env, stdio: 'inherit' })
process.exit(result.status ?? 1)
