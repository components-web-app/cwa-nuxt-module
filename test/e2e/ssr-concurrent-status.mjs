import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import net from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startStubApi } from './stub-api.mjs'

const apiPort = Number(process.env.E2E_API_PORT || 18313)
const appPort = Number(process.env.E2E_APP_PORT || 3313)
const rounds = Number(process.env.E2E_ROUNDS || 20)
const serverEntry = resolve(dirname(fileURLToPath(import.meta.url)), '../../playground/.output/server/index.mjs')
const appBase = `http://127.0.0.1:${appPort}`

const cases = [
  { name: 'real', path: () => '/real', expected: 200 },
  { name: 'missing', path: round => `/nope-${round}`, expected: 404 },
  { name: 'non-cwa', path: () => '/static', expected: 200 },
]

let stub
let app
let appLog = ''
let cleanedUp = false

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

async function assertErrorPageRenders() {
  const response = await fetch(`${appBase}/nope-error-page-render`, { redirect: 'manual', headers: { accept: 'text/html' } })
  const body = await response.text()
  if (response.status !== 404) {
    throw new Error(`Expected 404 from the error page, got ${response.status}`)
  }
  if (!body.includes('<canvas')) {
    throw new Error('The CWA error page rendered no content on the server (#331: <LazyCwaErrorPage> must resolve inside the Suspense boundary)')
  }
  console.log('Error page server-renders its content\n')
}

async function request(testCase, round, mode) {
  const path = testCase.path(round)
  const url = `${appBase}${path}?e2e=${mode}-${round}-${Math.random().toString(36).slice(2)}`
  const response = await fetch(url, { redirect: 'manual' })
  await response.text()
  return { name: testCase.name, path, expected: testCase.expected, status: response.status }
}

function report(label, round, results) {
  const wrong = results.filter(result => result.status !== result.expected)
  const detail = results
    .map(result => `${result.path}=${result.status}${result.status === result.expected ? '' : ` (expected ${result.expected})`}`)
    .join('  ')
  console.log(`${label} round ${String(round + 1).padStart(2)}: ${wrong.length ? 'WRONG' : 'ok   '}  ${detail}`)
  return wrong.length === 0
}

async function runRounds(label, runRound) {
  let failures = 0
  for (let round = 0; round < rounds; round++) {
    if (!report(label, round, await runRound(round))) {
      failures++
    }
  }
  return failures
}

async function main() {
  if (!existsSync(serverEntry)) {
    throw new Error(`No playground build at ${serverEntry}. Run "pnpm run dev:build" first.`)
  }
  await assertPortFree(apiPort)
  await assertPortFree(appPort)

  stub = await startStubApi(apiPort)

  const apiUrl = `http://127.0.0.1:${apiPort}/_api`
  app = spawn(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      NITRO_HOST: '127.0.0.1',
      PORT: String(appPort),
      NITRO_PORT: String(appPort),
      NUXT_PUBLIC_CWA_API_URL: apiUrl,
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
  await assertErrorPageRenders()

  console.log(`Sequential control: ${rounds} rounds, one request at a time`)
  const sequentialFailures = await runRounds('sequential', async (round) => {
    const results = []
    for (const testCase of cases) {
      results.push(await request(testCase, round, 'seq'))
    }
    return results
  })

  console.log(`\nConcurrent: ${rounds} rounds, ${cases.length} requests fired together`)
  const concurrentFailures = await runRounds('concurrent', round =>
    Promise.all(cases.map(testCase => request(testCase, round, 'con'))),
  )

  console.log(`\nsequential wrong: ${sequentialFailures}/${rounds}`)
  console.log(`concurrent wrong: ${concurrentFailures}/${rounds}`)

  if (sequentialFailures) {
    console.error('\nFAIL: the sequential control is wrong, so the setup is broken rather than the concurrency.')
    return finish(1)
  }
  if (concurrentFailures) {
    console.error('\nFAIL: concurrent SSR responses received another request\'s status (#313).')
    return finish(1)
  }
  console.log('\nPASS: every response carried its own status.')
  return finish(0)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  finish(1)
})
