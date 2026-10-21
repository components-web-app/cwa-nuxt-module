import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import net from 'node:net'
import { gzipSync } from 'node:zlib'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startStubApi } from './stub-api.mjs'

const apiPort = Number(process.env.E2E_API_PORT || 18382)
const appPort = Number(process.env.E2E_APP_PORT || 3382)
const outputDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../playground/.output')
const serverEntry = resolve(outputDir, 'server/index.mjs')
const chunkDir = resolve(outputDir, 'public/_nuxt')
const appBase = `http://127.0.0.1:${appPort}`

const gzipBudget = 183775

const required = [
  { marker: 'cwa-start', source: 'core/ComponentPosition.vue' },
]

const forbidden = [
  { marker: 'm5.69507059 20.3811012', source: 'core/assets/IconComponents.vue' },
  { marker: 'Manageable resource listener called to select component', source: 'admin/manageable-resource.ts' },
  { marker: 'vuejs-confirm-dialog-root', source: 'vuejs-confirm-dialog' },
  { marker: 'were saved to a new draft', source: 'admin/remote-changes.ts' },
  { marker: 'Real-time presence is turned off on the API', source: 'admin/presence.ts' },
  { marker: 'Live editing paused', source: 'header/_parts/PresenceIndicator.vue' },
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

function readPreloads(html) {
  const files = [...html.matchAll(/<link[^>]+rel="modulepreload"[^>]*>/g)]
    .map(([tag]) => tag.match(/href="[^"]*\/_nuxt\/([^"]+)"/)?.[1])
    .filter(Boolean)
  return files.map((file) => {
    const path = resolve(chunkDir, file)
    if (!existsSync(path)) {
      throw new Error(`The page preloads a missing chunk: ${file}`)
    }
    return { file, contents: readFileSync(path, 'utf8') }
  })
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

  const response = await fetch(`${appBase}/real`, { redirect: 'manual' })
  const html = await response.text()
  if (response.status !== 200 || !html.includes('E2E Real Page')) {
    throw new Error(`The visitor page did not render (status ${response.status})\n${appLog.slice(-4000)}`)
  }

  const chunks = readPreloads(html)
  const raw = chunks.reduce((total, chunk) => total + chunk.contents.length, 0)
  const gzip = chunks.reduce((total, chunk) => total + gzipSync(chunk.contents, { level: 9 }).length, 0)
  console.log(`Visitor page /real modulepreloads: ${chunks.length} chunks, ${raw} B raw, ${gzip} B gzip (budget ${gzipBudget} B)`)

  const failures = []
  for (const { marker, source } of required) {
    const present = chunks.some(chunk => chunk.contents.includes(marker))
    console.log(`  ${present ? 'present' : 'MISSING'} ${source} (${marker})`)
    if (!present) {
      failures.push(`${source} is not preloaded, so the absence checks below prove nothing`)
    }
  }
  for (const { marker, source } of forbidden) {
    const hits = chunks.filter(chunk => chunk.contents.includes(marker)).map(chunk => chunk.file)
    console.log(`  ${hits.length ? 'FOUND  ' : 'absent '} ${source} (${marker})${hits.length ? ` in ${hits.join(', ')}` : ''}`)
    if (hits.length) {
      failures.push(`${source} is preloaded for an anonymous visitor -> ${hits.join(', ')}`)
    }
  }
  if (gzip > gzipBudget) {
    failures.push(`the page preloads ${gzip} B gzip, over the ${gzipBudget} B budget`)
  }

  if (failures.length) {
    console.error('\nFAIL: an anonymous visitor\'s page preloads admin-only code, or more than its budget (#382).')
    for (const failure of failures) {
      console.error(`  ${failure}`)
    }
    return finish(1)
  }
  console.log('\nPASS: no admin-only code in an anonymous visitor\'s page preloads, within budget.')
  return finish(0)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  finish(1)
})
