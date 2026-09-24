import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import net from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setScheduledRouteLive, startStubApi } from './stub-api.mjs'

const apiPort = Number(process.env.E2E_API_PORT || 18314)
const appPort = Number(process.env.E2E_APP_PORT || 3314)
const serverEntry = resolve(dirname(fileURLToPath(import.meta.url)), '../../playground/.output/server/index.mjs')
const appBase = `http://127.0.0.1:${appPort}`

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
  const response = await fetch(`${appBase}${path}`, { redirect: 'manual', headers: { accept: 'text/html' } })
  await response.text()
  return {
    status: response.status,
    cacheControl: response.headers.get('cache-control'),
    surrogateKey: response.headers.get('surrogate-key'),
  }
}

function check(label, passed, detail) {
  console.log(`${passed ? 'ok   ' : 'WRONG'} ${label}${detail ? `  ${detail}` : ''}`)
  if (!passed) {
    failures++
  }
}

function expectNotStored(label, response, expectedStatus) {
  const detail = `${expectedStatus} cache-control=${response.cacheControl} surrogate-key=${response.surrogateKey}`
  check(
    label,
    response.status === expectedStatus
    && !!response.cacheControl?.includes('no-store')
    && response.surrogateKey === null,
    detail,
  )
}

function expectStored(label, response) {
  const detail = `cache-control=${response.cacheControl} surrogate-key=${response.surrogateKey}`
  check(
    label,
    response.status === 200
    && !!response.cacheControl?.includes('s-maxage=')
    && !!response.surrogateKey?.startsWith('cwa-html'),
    detail,
  )
}

async function main() {
  if (!existsSync(serverEntry)) {
    throw new Error(`No playground build at ${serverEntry}. Run "pnpm run dev:build" first.`)
  }
  await assertPortFree(apiPort)
  await assertPortFree(appPort)

  setScheduledRouteLive(false)
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

  console.log('#340 error pages must never be stored in a shared cache\n')

  expectStored('a live CWA page is stored and tagged', await load('/real'))
  expectNotStored('a URL with no route at all', await load('/nope-123'), 404)
  expectNotStored('a route that is not live yet', await load('/scheduled'), 404)
  expectNotStored('an API failure during the render', await load('/broken'), 500)
  expectNotStored('a page that throws on a route the API serves', await load('/e2e-broken-render'), 500)

  setScheduledRouteLive(true)
  expectStored('the same route once it goes live', await load('/scheduled'))

  console.log(`\nwrong: ${failures}`)
  if (failures) {
    console.error('\nFAIL: an error page carried cacheable headers, so a shared cache would store it (#340).')
    return finish(1)
  }
  console.log('\nPASS: every error response was marked no-store and carried no surrogate key.')
  return finish(0)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  finish(1)
})
