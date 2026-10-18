import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import net from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { mercurePath, startAdminStubApi } from './admin-stub-api.mjs'

const serverEntry = resolve(dirname(fileURLToPath(import.meta.url)), '../../playground/.output/server/index.mjs')

function assertPortFree(port) {
  return new Promise((resolvePort, reject) => {
    const probe = net.createServer()
    probe.once('error', () => reject(new Error(`Port ${port} is already in use`)))
    probe.listen(port, '127.0.0.1', () => probe.close(resolvePort))
  })
}

export async function startAdminStack({ apiPort, appPort }) {
  if (!existsSync(serverEntry)) {
    throw new Error(`No playground build at ${serverEntry}. Run "pnpm run dev:build" first.`)
  }
  await assertPortFree(apiPort)
  await assertPortFree(appPort)
  const { server: stub, state, reset } = await startAdminStubApi(apiPort)
  const apiUrl = `http://127.0.0.1:${apiPort}/_api`
  let appLog = ''
  const app = spawn(process.execPath, [serverEntry], {
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

  const appBase = `http://127.0.0.1:${appPort}`
  const deadline = Date.now() + 60000
  for (;;) {
    if (app.exitCode !== null) {
      throw new Error(`Playground server exited with code ${app.exitCode}\n${appLog.slice(-4000)}`)
    }
    const status = await fetch(`${appBase}/_cwa/healthcheck`).then(r => r.status).catch(() => 0)
    if (status === 200) {
      break
    }
    if (Date.now() > deadline) {
      throw new Error(`Playground server did not become ready on ${appBase}\n${appLog.slice(-4000)}`)
    }
    await new Promise(r => setTimeout(r, 250))
  }

  const browser = await chromium.launch({ headless: true })

  async function stop() {
    await browser.close().catch(() => undefined)
    if (app.exitCode === null && app.signalCode === null) {
      app.kill('SIGTERM')
      await new Promise((r) => {
        const hard = setTimeout(() => {
          app.kill('SIGKILL')
          r()
        }, 3000)
        app.once('exit', () => {
          clearTimeout(hard)
          r()
        })
      })
    }
    stub.closeAllConnections?.()
    await new Promise(r => stub.close(r))
  }

  return { appBase, browser, state, reset, stop, appLog: () => appLog }
}

const quietMs = 300

export async function newAdminPage(stack) {
  const context = await stack.browser.newContext({ viewport: { width: 1400, height: 1000 }, serviceWorkers: 'block' })
  await context.addCookies([{ name: 'cwa_auth', value: '1', url: stack.appBase }])
  context.setDefaultTimeout(10000)
  const page = await context.newPage()
  const errors = []
  const consoleErrors = []
  const inFlight = new Set()
  let lastActivity = Date.now()
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })
  const track = (request) => {
    if (!request.url().includes(mercurePath)) {
      inFlight.add(request)
      lastActivity = Date.now()
    }
  }
  const untrack = (request) => {
    if (inFlight.delete(request)) {
      lastActivity = Date.now()
    }
  }
  page.on('request', track)
  page.on('requestfinished', untrack)
  page.on('requestfailed', untrack)

  async function settle(timeout = 10000) {
    const deadline = Date.now() + timeout
    for (;;) {
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))).catch(() => undefined)
      if (!inFlight.size && Date.now() - lastActivity >= quietMs) {
        return
      }
      if (Date.now() > deadline) {
        throw new Error(`The page did not settle: ${[...inFlight].map(r => r.url()).join(', ')}`)
      }
      await page.waitForEvent('requestfinished', { timeout: quietMs }).catch(() => undefined)
    }
  }

  return { context, page, errors, consoleErrors, settle }
}
