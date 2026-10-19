import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import net from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test as base, expect } from '@playwright/test'
import { createApiClient } from './api-client.mjs'
import { mercurePath, startRehearsal } from './rehearsal.mjs'
import { seedClonePages } from './seed.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const serverEntry = resolve(here, '../../playground/.output/server/index.mjs')

export const rehearsalOptions = () => ({
  mode: process.env.REHEARSAL_MODE === 'record' ? 'record' : 'replay',
  target: process.env.REHEARSAL_API || 'https://localhost',
  ca: process.env.REHEARSAL_CA,
  bundle: process.env.REHEARSAL_BUNDLE,
  apiPort: Number(process.env.E2E_API_PORT || 18421),
  appPort: Number(process.env.E2E_APP_PORT || 3421),
})

function assertPortFree(port) {
  return new Promise((resolvePort, reject) => {
    const probe = net.createServer()
    probe.once('error', () => reject(new Error(`Port ${port} is already in use`)))
    probe.listen(port, '127.0.0.1', () => probe.close(resolvePort))
  })
}

async function startApp({ appPort, apiUrl }) {
  if (!existsSync(serverEntry)) {
    throw new Error(`No playground build at ${serverEntry}. Run "pnpm run dev:build" first.`)
  }
  await assertPortFree(appPort)
  let log = ''
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
    log = (log + chunk.toString()).slice(-20000)
  }
  app.stdout.on('data', capture)
  app.stderr.on('data', capture)
  const appBase = `http://127.0.0.1:${appPort}`
  const deadline = Date.now() + 60000
  for (;;) {
    if (app.exitCode !== null) {
      throw new Error(`Playground server exited with code ${app.exitCode}\n${log.slice(-4000)}`)
    }
    const status = await fetch(`${appBase}/_cwa/healthcheck`).then(r => r.status).catch(() => 0)
    if (status === 200) {
      break
    }
    if (Date.now() > deadline) {
      throw new Error(`Playground server did not become ready on ${appBase}\n${log.slice(-4000)}`)
    }
    await new Promise(r => setTimeout(r, 250))
  }
  return {
    appBase,
    log: () => log,
    async stop() {
      if (app.exitCode !== null || app.signalCode !== null) {
        return
      }
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
    },
  }
}

const quietMs = 300

function trackActivity(page) {
  const inFlight = new Set()
  let lastActivity = Date.now()
  page.on('request', (request) => {
    if (!request.url().includes(mercurePath)) {
      inFlight.add(request)
      lastActivity = Date.now()
    }
  })
  const untrack = (request) => {
    if (inFlight.delete(request)) {
      lastActivity = Date.now()
    }
  }
  page.on('requestfinished', untrack)
  page.on('requestfailed', untrack)

  return async function settle(timeout = 10000) {
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
}

export const test = base.extend({
  stack: [async ({}, use) => { // eslint-disable-line no-empty-pattern
    const options = rehearsalOptions()
    await assertPortFree(options.apiPort)
    const rehearsal = await startRehearsal({ port: options.apiPort, mode: options.mode, target: options.target, ca: options.ca, bundle: options.bundle })
    let app
    try {
      app = await startApp({ appPort: options.appPort, apiUrl: `${rehearsal.origin}/_api` })
      await use({ rehearsal, appBase: app.appBase, appLog: app.log })
    }
    finally {
      await app?.stop()
      await rehearsal.stop()
    }
  }, { scope: 'worker', timeout: 90000 }],

  cwa: async ({ stack, context, page }, use, testInfo) => {
    const { rehearsal, appBase } = stack
    const scenario = rehearsal.begin(testInfo.title)
    const api = createApiClient(rehearsal.origin)
    const allowedConsoleErrors = []
    const errors = []
    const consoleErrors = []
    let finished
    try {
      await api.login()
      const seed = await seedClonePages(api, scenario.token)
      scenario.writes.length = 0
      await context.addCookies([
        { name: 'cwa_auth', value: '1', url: appBase },
        ...(api.authCookie ? [{ ...api.authCookie, url: appBase, httpOnly: true }] : []),
      ])
      page.on('pageerror', error => errors.push(error.message))
      page.on('console', (message) => {
        if (message.type() === 'error') {
          consoleErrors.push(message.text())
        }
      })
      context.setDefaultTimeout(10000)
      await use({
        page,
        base: appBase,
        settle: trackActivity(page),
        api,
        seed,
        rehearsal: scenario,
        allowConsoleErrors: (...patterns) => allowedConsoleErrors.push(...patterns),
      })
      expect(scenario.unrecorded, 'Requests missing from the rehearsal').toEqual([])
      expect(errors, 'Uncaught page errors').toEqual([])
      expect(consoleErrors.filter(message => !allowedConsoleErrors.some(pattern => pattern.test(message))), 'Console errors').toEqual([])
      finished = true
    }
    finally {
      await rehearsal.end({ save: testInfo.status === testInfo.expectedStatus && (finished || testInfo.expectedStatus === 'failed') })
      if (rehearsal.mode === 'record') {
        await api.cleanup()
      }
    }
  },
})

export { expect }
