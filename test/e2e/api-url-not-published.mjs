import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { startStubApi } from './stub-api.mjs'

const serverEntry = fileURLToPath(new URL('../../playground/.output/server/index.mjs', import.meta.url))
const apiPort = 45521
const appPort = 45522
const appBase = `http://127.0.0.1:${appPort}`
const browserApiUrl = 'https://browser.example.invalid/_api'

let stub
let app
let appLog = ''

function finish(code) {
  if (app) app.kill()
  if (stub) stub.close()
  if (code !== 0 && appLog) {
    console.error(`\n--- app log ---\n${appLog}`)
  }
  process.exitCode = code
}

function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', () => reject(new Error(`Port ${port} is already in use.`)))
    server.once('listening', () => server.close(() => resolve()))
    server.listen(port, '127.0.0.1')
  })
}

async function waitForApp() {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await fetch(`${appBase}/_cwa/healthcheck`)
      return
    }
    catch {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }
  throw new Error('The playground server did not start.')
}

function extractPublishedRuntimeConfig(html) {
  const marker = 'window.__NUXT__.config='
  const start = html.indexOf(marker)
  if (start === -1) {
    throw new Error('The rendered page carries no window.__NUXT__.config, so this check cannot prove anything.')
  }
  const end = html.indexOf('</script>', start)
  return html.slice(start + marker.length, end)
}

async function main() {
  if (!existsSync(serverEntry)) {
    throw new Error(`No playground build at ${serverEntry}. Run "pnpm run dev:build" first.`)
  }
  await assertPortFree(apiPort)
  await assertPortFree(appPort)

  stub = await startStubApi(apiPort)

  const privateApiUrl = `http://127.0.0.1:${apiPort}/_api`
  const env = { ...process.env }
  delete env.NUXT_PUBLIC_CWA_API_URL
  app = spawn(process.execPath, [serverEntry], {
    env: {
      ...env,
      HOST: '127.0.0.1',
      NITRO_HOST: '127.0.0.1',
      PORT: String(appPort),
      NITRO_PORT: String(appPort),
      NUXT_CWA_API_URL: privateApiUrl,
      NUXT_PUBLIC_CWA_API_URL_BROWSER: browserApiUrl,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const capture = (chunk) => {
    appLog = (appLog + chunk.toString()).slice(-20000)
  }
  app.stdout.on('data', capture)
  app.stderr.on('data', capture)

  await waitForApp()

  const response = await fetch(`${appBase}/real`)
  const html = await response.text()

  if (response.status !== 200) {
    console.error(`FAIL: /real answered ${response.status}, so the server never reached the API through NUXT_CWA_API_URL.`)
    return finish(1)
  }
  if (!html.includes('E2E Real Page')) {
    console.error('FAIL: /real rendered no resource data, so the private API URL did not drive the render.')
    return finish(1)
  }
  console.log('Rendered /real from the API using the private URL only')

  const publishedConfig = extractPublishedRuntimeConfig(html)
  if (publishedConfig.includes(`127.0.0.1:${apiPort}`)) {
    console.error(`FAIL: the published runtime config carries the server's API URL.\n${publishedConfig.slice(0, 400)}`)
    return finish(1)
  }
  if (!publishedConfig.includes(browserApiUrl)) {
    console.error('FAIL: the published runtime config carries no browser API URL, so the check passed for the wrong reason.')
    return finish(1)
  }
  console.log('Published runtime config carries the browser URL and not the server URL')

  console.log('\nNote: this only covers runtimeConfig. `apiDocumentation.docsPath` and `mercure.hub` are read from the')
  console.log('API\'s own Link headers during SSR and are serialised into the payload, so a real API still puts its')
  console.log('URL there. The stub sends no Link headers, so this run cannot show it either way.')

  console.log('\nPASS: the server API URL is not published to the browser.')
  return finish(0)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  finish(1)
})
