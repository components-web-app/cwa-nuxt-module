import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import net from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setSitemapRoutePaths, startStubApi } from './stub-api.mjs'

const apiPort = Number(process.env.E2E_API_PORT || 18344)
const appPort = Number(process.env.E2E_APP_PORT || 3344)
const serverEntry = resolve(dirname(fileURLToPath(import.meta.url)), '../../playground/.output/server/index.mjs')
const appBase = `http://127.0.0.1:${appPort}`

const EXPECTED_CACHE_CONTROL = 'public, max-age=0, s-maxage=600'
const EXPECTED_SURROGATE_KEY = 'cwa-html, /_api/_/routes'

let stub
let app
let appLog = ''
let cleanedUp = false
let failures = 0

function cleanup() {
  if (cleanedUp) {
    return
  }
  cleanedUp = true
  if (app && app.exitCode === null && app.signalCode === null) {
    app.kill('SIGTERM')
    const hardKill = setTimeout(() => app.kill('SIGKILL'), 3000)
    hardKill.unref()
  }
  if (stub) {
    stub.closeAllConnections?.()
    stub.close()
  }
}

function waitForAppExit() {
  if (!app || app.exitCode !== null || app.signalCode !== null) {
    return Promise.resolve()
  }
  return new Promise(resolveExit => app.once('exit', resolveExit))
}

async function finish(code) {
  cleanup()
  await waitForAppExit()
  process.exit(code)
}

process.on('SIGINT', () => finish(130))
process.on('SIGTERM', () => finish(143))
process.on('exit', cleanup)
process.on('uncaughtException', (error) => {
  console.error(error)
  finish(1)
})
process.on('unhandledRejection', (error) => {
  console.error(error)
  finish(1)
})

function assertPortFree(port) {
  return new Promise((resolvePort, reject) => {
    const probe = net.createServer()
    probe.once('error', () => reject(new Error(`Port ${port} is already in use`)))
    probe.listen(port, '127.0.0.1', () => probe.close(resolvePort))
  })
}

async function waitForApp() {
  const deadline = Date.now() + 60000
  while (Date.now() < deadline) {
    if (app.exitCode !== null) {
      throw new Error(`Playground server exited with code ${app.exitCode}\n${appLog.slice(-4000)}`)
    }
    const status = await fetch(`${appBase}/static?ready=${Date.now()}`, { redirect: 'manual' })
      .then(async (response) => {
        await response.text()
        return response.status
      })
      .catch(() => 0)
    if (status === 200) {
      return
    }
    await new Promise(r => setTimeout(r, 250))
  }
  throw new Error(`Playground server did not become ready on ${appBase}\n${appLog.slice(-4000)}`)
}

async function load(path) {
  const response = await fetch(`${appBase}${path}`, { redirect: 'manual' })
  return {
    status: response.status,
    cacheControl: response.headers.get('cache-control'),
    surrogateKey: response.headers.get('surrogate-key'),
    location: response.headers.get('location'),
    body: await response.text(),
  }
}

function check(label, passed, detail) {
  console.log(`${passed ? 'ok   ' : 'WRONG'} ${label}${detail ? `  ${detail}` : ''}`)
  if (!passed) {
    failures++
  }
}

function expectSitemapHeaders(label, response, surrogateKey) {
  check(
    label,
    response.status === 200
    && response.cacheControl === EXPECTED_CACHE_CONTROL
    && response.surrogateKey === surrogateKey,
    `${response.status} cache-control=${response.cacheControl} surrogate-key=${response.surrogateKey}`,
  )
}

async function main() {
  if (!existsSync(serverEntry)) {
    throw new Error(`No playground build at ${serverEntry}. Run "pnpm run dev:build" first.`)
  }
  await assertPortFree(apiPort)
  await assertPortFree(appPort)

  setSitemapRoutePaths(['/real'])
  stub = await startStubApi(apiPort)

  const apiUrl = `http://127.0.0.1:${apiPort}/_api`
  app = spawn(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      NITRO_HOST: '127.0.0.1',
      PORT: String(appPort),
      NITRO_PORT: String(appPort),
      NUXT_CWA_API_URL: apiUrl,
      NUXT_PUBLIC_CWA_API_URL_BROWSER: apiUrl,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const capture = (chunk) => {
    appLog = (appLog + chunk.toString()).slice(-20000)
  }
  app.stdout.on('data', capture)
  app.stderr.on('data', capture)

  await waitForApp()

  console.log('#344 the sitemap must be purgeable, and never held in a per-process cache\n')

  expectSitemapHeaders('the sitemap index is tagged with the route collection', await load('/sitemap_index.xml'), EXPECTED_SURROGATE_KEY)
  expectSitemapHeaders('a chunked child sitemap is tagged with the route collection', await load('/__sitemap__/cwa-0.xml'), EXPECTED_SURROGATE_KEY)
  expectSitemapHeaders('the custom sitemap is tagged as rendered html only', await load('/__sitemap__/cwa-custom.xml'), 'cwa-html')

  const before = await load('/__sitemap__/cwa-0.xml')
  check('a route the API has not published yet is absent', !before.body.includes('/brand-new'), '')

  setSitemapRoutePaths(['/real', '/brand-new'])
  const after = await load('/__sitemap__/cwa-0.xml')
  check(
    'a new route is listed on the very next request, with no per-process cache to wait out',
    after.status === 200 && after.body.includes('/brand-new'),
    `${after.status}`,
  )

  const entry = await load('/sitemap.xml')
  check(
    'the entry point redirects to the sitemap index, which is what a cache warm follows',
    entry.status === 307 && entry.location === '/sitemap_index.xml',
    `${entry.status} location=${entry.location}`,
  )

  const stylesheet = await load('/__sitemap__/style.xsl')
  check(
    'the stylesheet is left as the sitemap package rendered it',
    stylesheet.status === 200 && stylesheet.surrogateKey === null,
    `${stylesheet.status} cache-control=${stylesheet.cacheControl} surrogate-key=${stylesheet.surrogateKey}`,
  )

  console.log(`\nwrong: ${failures}`)
  if (failures) {
    console.error('\nFAIL: the sitemap is either untagged, held in a per-process cache, or both (#344).')
    return finish(1)
  }
  console.log('\nPASS: every sitemap response was tagged for purge and built from the API on request.')
  return finish(0)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  finish(1)
})
