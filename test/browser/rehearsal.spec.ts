// @vitest-environment node
import http from 'node:http'
import net from 'node:net'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { cleanupHeader, mercurePath, rehearsalFileName, seedHeader, startRehearsal, UnrecordedRequestError } from './rehearsal.mjs'

const TITLE = '1. a scenario'

type Handler = (req: http.IncomingMessage, body: string) => { status?: number, headers?: Record<string, string | string[]>, body?: unknown }

interface FakeApi {
  origin: string
  requests: Array<{ method?: string, url?: string, path?: string, body: string }>
  stop: () => Promise<void>
}

async function freePort() {
  return new Promise<number>((resolve) => {
    const probe = net.createServer()
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as net.AddressInfo
      probe.close(() => resolve(port))
    })
  })
}

async function startFakeApi(handler: Handler): Promise<FakeApi> {
  const requests: FakeApi['requests'] = []
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      requests.push({ method: req.method, url: req.url, path: req.headers.path as string | undefined, body })
      const answer = handler(req, body)
      res.writeHead(answer.status ?? 200, { 'content-type': 'application/ld+json', ...answer.headers })
      res.end(answer.body === undefined ? '' : JSON.stringify(answer.body))
    })
  })
  const port = await freePort()
  await new Promise<void>(resolve => server.listen(port, '127.0.0.1', resolve))
  return {
    origin: `http://127.0.0.1:${port}`,
    requests,
    stop: () => new Promise((resolve) => {
      server.closeAllConnections()
      server.close(() => resolve())
    }),
  }
}

let dir: string
const cleanups: Array<() => Promise<void>> = []

async function record(api: FakeApi, run: (origin: string) => Promise<void>) {
  const proxy = await startRehearsal({ port: await freePort(), mode: 'record', dir, target: api.origin, bundle: '2.0.0-alpha.32 (test)' })
  cleanups.push(() => proxy.stop())
  const scenario = proxy.begin(TITLE)
  await run(proxy.origin)
  await proxy.end({ save: true })
  await proxy.stop()
  return scenario
}

async function replay(run: (origin: string, scenario: any) => Promise<void>) {
  const proxy = await startRehearsal({ port: await freePort(), mode: 'replay', dir })
  cleanups.push(() => proxy.stop())
  const scenario = proxy.begin(TITLE)
  await run(proxy.origin, scenario)
  await proxy.end({ save: false })
  await proxy.stop()
  return scenario
}

function readRecording() {
  return JSON.parse(gunzipSync(readFileSync(join(dir, rehearsalFileName(TITLE)))).toString('utf8'))
}

async function getJson(url: string, init: RequestInit = {}) {
  const response = await fetch(url, init)
  const text = await response.text()
  return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : undefined }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'rehearsal-spec-'))
})

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) {
    await cleanup().catch(() => undefined)
  }
  rmSync(dir, { recursive: true, force: true })
})

describe('rehearsal proxy', () => {
  test('replays a recorded response with the API stopped, stamped with the bundle and API it was recorded against', async () => {
    const api = await startFakeApi(() => ({ body: { '@id': '/_api/component/a', 'html': 'A' } }))
    await record(api, async (origin) => {
      expect((await getJson(`${origin}/_api/component/a`)).body).toEqual({ '@id': '/_api/component/a', 'html': 'A' })
    })
    await api.stop()

    await replay(async (origin) => {
      const replayed = await getJson(`${origin}/_api/component/a`)
      expect(replayed.status).toBe(200)
      expect(replayed.body).toEqual({ '@id': '/_api/component/a', 'html': 'A' })
    })
    expect(readRecording()).toMatchObject({ scenario: TITLE, bundle: '2.0.0-alpha.32 (test)', api: api.origin })
  })

  test('a request missing from the rehearsal answers 599 and is listed as unrecorded, never guessed', async () => {
    const api = await startFakeApi(() => ({ body: {} }))
    await record(api, async (origin) => {
      await getJson(`${origin}/_api/recorded`)
    })
    await api.stop()

    const scenario = await replay(async (origin) => {
      const response = await getJson(`${origin}/_api/never-recorded`, { headers: { path: '/somewhere' } })
      expect(response.status).toBe(599)
    })
    expect(scenario.unrecorded).toEqual(['GET /_api/never-recorded (path: /somewhere)'])
  })

  test('a read after a write replays the answer recorded after that write, and a read before it the earlier one', async () => {
    const items = ['a']
    const api = await startFakeApi((req, body) => {
      if (req.method === 'POST') {
        items.push(JSON.parse(body).name)
        return { status: 201, body: { name: JSON.parse(body).name } }
      }
      return { body: [...items] }
    })
    await record(api, async (origin) => {
      await getJson(`${origin}/_api/items`)
      await getJson(`${origin}/_api/items`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'b' }) })
      await getJson(`${origin}/_api/items`)
    })
    await api.stop()

    const scenario = await replay(async (origin) => {
      expect((await getJson(`${origin}/_api/items`)).body).toEqual(['a'])
      expect((await getJson(`${origin}/_api/items`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'b' }) })).status).toBe(201)
      expect((await getJson(`${origin}/_api/items`)).body).toEqual(['a', 'b'])
    })
    expect(scenario.writes).toEqual([{ method: 'POST', path: '/_api/items', body: { name: 'b' } }])
  })

  test('a write body matches however its keys are ordered', async () => {
    const api = await startFakeApi(() => ({ status: 201, body: { ok: true } }))
    await record(api, async (origin) => {
      await getJson(`${origin}/_api/things`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ a: 1, b: 2 }) })
    })
    await api.stop()

    await replay(async (origin) => {
      expect((await getJson(`${origin}/_api/things`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ b: 2, a: 1 }) })).status).toBe(201)
    })
  })

  test('the same request repeated before any write replays each recorded answer in turn, then keeps the last', async () => {
    let count = 0
    const api = await startFakeApi(() => ({ body: { count: ++count } }))
    await record(api, async (origin) => {
      await getJson(`${origin}/_api/counter`)
      await getJson(`${origin}/_api/counter`)
    })
    await api.stop()

    await replay(async (origin) => {
      expect((await getJson(`${origin}/_api/counter`)).body).toEqual({ count: 1 })
      expect((await getJson(`${origin}/_api/counter`)).body).toEqual({ count: 2 })
      expect((await getJson(`${origin}/_api/counter`)).body).toEqual({ count: 2 })
    })
  })

  test('a path header that differs from the recording, as during a redirect, falls back to the request without it', async () => {
    const api = await startFakeApi(req => ({ body: { path: req.headers.path } }))
    await record(api, async (origin) => {
      await getJson(`${origin}/_api/_/component_positions/p1`, { headers: { path: '/first' } })
    })
    await api.stop()

    await replay(async (origin) => {
      expect((await getJson(`${origin}/_api/_/component_positions/p1`, { headers: { path: '/first' } })).body).toEqual({ path: '/first' })
      expect((await getJson(`${origin}/_api/_/component_positions/p1`, { headers: { path: '/redirected' } })).body).toEqual({ path: '/first' })
    })
  })

  test('the API\'s origin is rewritten to the proxy\'s in bodies and headers, and the Mercure hub points at the proxy', async () => {
    let apiOrigin = ''
    const api = await startFakeApi(() => ({
      headers: { link: `<${apiOrigin}/docs.jsonld>; rel="http://www.w3.org/ns/hydra/core#apiDocumentation",<https://hub.example/.well-known/mercure>; rel="mercure"` },
      body: { file: `${apiOrigin}/media/a.png` },
    }))
    apiOrigin = api.origin
    const recordProxy = await startRehearsal({ port: await freePort(), mode: 'record', dir, target: api.origin })
    cleanups.push(() => recordProxy.stop())
    recordProxy.begin(TITLE)
    const proxyOrigin = recordProxy.origin
    const recorded = await getJson(`${proxyOrigin}/_api/media/a`)
    await recordProxy.end({ save: true })
    await recordProxy.stop()

    expect(recorded.body).toEqual({ file: `${proxyOrigin}/media/a.png` })
    expect(recorded.headers.get('link')).toBe(`<${proxyOrigin}/docs.jsonld>; rel="http://www.w3.org/ns/hydra/core#apiDocumentation",<${proxyOrigin}${mercurePath}>; rel="mercure"`)
    await api.stop()

    await replay(async (origin) => {
      const replayed = await getJson(`${origin}/_api/media/a`)
      expect(replayed.body).toEqual({ file: `${origin}/media/a.png` })
      expect(replayed.headers.get('link')).toContain(`<${origin}${mercurePath}>; rel="mercure"`)
    })
  })

  test('cookie values are redacted in the saved rehearsal, and served without Secure, Domain or __Secure- cookies', async () => {
    const api = await startFakeApi(() => ({
      status: 204,
      headers: { 'set-cookie': ['api_component=secret-jwt; Path=/; Domain=localhost; Secure; HttpOnly', '__Secure-mercure_access_token=hub-jwt; Path=/; Secure'] },
    }))
    await record(api, async (origin) => {
      const response = await fetch(`${origin}/_api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      const served = response.headers.getSetCookie()
      expect(served).toEqual(['api_component=secret-jwt; Path=/; HttpOnly'])
    })
    await api.stop()

    const saved = JSON.stringify(readRecording())
    expect(saved).not.toContain('secret-jwt')
    expect(saved).not.toContain('hub-jwt')
    expect(readRecording().entries[0].response.headers['set-cookie']).toEqual(['api_component=rehearsal; Path=/; Domain=localhost; Secure; HttpOnly', '__Secure-mercure_access_token=rehearsal; Path=/; Secure'])
  })

  test('Mercure is served by the proxy as a silent stream and counted, never forwarded to the API', async () => {
    const api = await startFakeApi(() => ({ body: {} }))
    const proxy = await startRehearsal({ port: await freePort(), mode: 'record', dir, target: api.origin })
    cleanups.push(() => proxy.stop())
    const scenario = proxy.begin(TITLE)
    const controller = new AbortController()
    const response = await fetch(`${proxy.origin}${mercurePath}?match=*`, { signal: controller.signal })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/event-stream')
    controller.abort()
    await proxy.end({ save: false })
    await proxy.stop()
    await api.stop()

    expect(scenario.mercureSubscriptions).toBe(1)
    expect(api.requests).toEqual([])
  })

  test('a scenario\'s published messages reach every open Mercure stream with their event id', async () => {
    const api = await startFakeApi(() => ({ body: {} }))
    const proxy = await startRehearsal({ port: await freePort(), mode: 'record', dir, target: api.origin })
    cleanups.push(() => proxy.stop())
    proxy.begin(TITLE)
    const readers = await Promise.all([0, 1].map(async () => {
      const response = await fetch(`${proxy.origin}${mercurePath}?match=*`)
      const reader = response.body!.getReader()
      await reader.read()
      return reader
    }))

    proxy.publish({ '@type': 'CwaRealtimeEvent', 'event': 'presence' }, { id: 'urn:uuid:1' })
    proxy.publish({ '@id': '/_api/component/a' })

    const decoder = new TextDecoder()
    for (const reader of readers) {
      let text = ''
      while (!text.includes('component/a')) {
        const { value, done } = await reader.read()
        if (done) {
          break
        }
        text += decoder.decode(value)
      }
      expect(text).toBe('id: urn:uuid:1\ndata: {"@type":"CwaRealtimeEvent","event":"presence"}\n\ndata: {"@id":"/_api/component/a"}\n\n')
    }
    await proxy.end({ save: false })
    await proxy.stop()
    await api.stop()
    expect(api.requests).toEqual([])
  })

  test('the tab\'s client id header is forwarded to the API and allowed by CORS', async () => {
    const api = await startFakeApi(req => ({ body: { clientId: req.headers['x-cwa-client-id'] } }))
    await record(api, async (origin) => {
      expect((await getJson(`${origin}/_api/component/a`, { method: 'PATCH', headers: { 'content-type': 'application/merge-patch+json', 'x-cwa-client-id': 'tab-1' }, body: '{}' })).body).toEqual({ clientId: 'tab-1' })
      const preflight = await fetch(`${origin}/_api/component/a`, { method: 'OPTIONS', headers: { origin: 'http://app.test' } })
      expect(preflight.headers.get('access-control-allow-headers')!.split(/,\s*/)).toContain('x-cwa-client-id')
    })
    await api.stop()
  })

  test.each(['record', 'replay'] as const)('a real-time POST is answered 202 while %sing, kept on the scenario, and never forwarded, recorded or counted as a write', async (mode) => {
    const api = await startFakeApi(() => ({ body: {} }))
    await record(api, async (origin) => {
      await getJson(`${origin}/_api/component/a`)
    })
    const proxy = mode === 'record'
      ? await startRehearsal({ port: await freePort(), mode, dir, target: api.origin })
      : await startRehearsal({ port: await freePort(), mode, dir })
    cleanups.push(() => proxy.stop())
    const scenario = proxy.begin(TITLE)
    const posted = { clientId: 'tab-1', event: 'presence', data: { state: 'viewing' } }
    const response = await fetch(`${proxy.origin}/_api/_/realtime`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(posted) })
    const beacon = await fetch(`${proxy.origin}/_/realtime`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ ...posted, data: { state: 'left' } }) })
    if (mode === 'replay') {
      expect((await getJson(`${proxy.origin}/_api/component/a`)).status).toBe(200)
    }
    await proxy.end({ save: false })
    await proxy.stop()
    await api.stop()

    expect(response.status).toBe(202)
    expect(beacon.status).toBe(202)
    expect(scenario.realtime).toEqual([posted, { ...posted, data: { state: 'left' } }])
    expect(scenario.writes).toEqual([])
    expect(scenario.unrecorded).toEqual([])
    expect(scenario.entries).toEqual([])
    expect(scenario.epoch).toBe(0)
    expect(api.requests.map(request => request.url)).toEqual(['/_api/component/a'])
  })

  test('CORS preflights are answered by the proxy, never forwarded', async () => {
    const api = await startFakeApi(() => ({ body: {} }))
    const proxy = await startRehearsal({ port: await freePort(), mode: 'record', dir, target: api.origin })
    cleanups.push(() => proxy.stop())
    proxy.begin(TITLE)
    const response = await fetch(`${proxy.origin}/_api/anything`, { method: 'OPTIONS', headers: { origin: 'http://app.test' } })
    await proxy.end({ save: false })
    await proxy.stop()
    await api.stop()

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('http://app.test')
    expect(response.headers.get('access-control-allow-credentials')).toBe('true')
    expect(api.requests).toEqual([])
  })

  test('seeding writes reach the API but are not counted as the scenario\'s own writes', async () => {
    const api = await startFakeApi(() => ({ status: 201, body: {} }))
    const scenario = await record(api, async (origin) => {
      await fetch(`${origin}/_api/pages`, { method: 'POST', headers: { 'content-type': 'application/json', [seedHeader]: '1' }, body: '{}' })
      await fetch(`${origin}/_api/positions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    })
    await api.stop()

    expect(api.requests.map(request => request.url)).toEqual(['/_api/pages', '/_api/positions'])
    expect(scenario.writes.map((write: { path: string }) => write.path)).toEqual(['/_api/positions'])
  })

  test('clean-up requests are forwarded while recording and answered locally while replaying', async () => {
    const api = await startFakeApi(() => ({ status: 204 }))
    await record(api, async (origin) => {
      expect((await fetch(`${origin}/_api/pages/x`, { method: 'DELETE', headers: { [cleanupHeader]: '1' } })).status).toBe(204)
    })
    await api.stop()
    expect(api.requests.map(request => request.method)).toEqual(['DELETE'])

    await replay(async (origin) => {
      expect((await fetch(`${origin}/_api/pages/x`, { method: 'DELETE', headers: { [cleanupHeader]: '1' } })).status).toBe(204)
    })
  })

  test('replaying a scenario that was never rehearsed fails at once, naming it', async () => {
    const proxy = await startRehearsal({ port: await freePort(), mode: 'replay', dir })
    cleanups.push(() => proxy.stop())
    expect(() => proxy.begin('9. never rehearsed')).toThrow(UnrecordedRequestError)
    expect(() => proxy.begin('9. never rehearsed')).toThrow('No rehearsal for "9. never rehearsed"')
  })

  test('a request with no scenario running is refused rather than forwarded', async () => {
    const api = await startFakeApi(() => ({ body: {} }))
    const proxy = await startRehearsal({ port: await freePort(), mode: 'record', dir, target: api.origin })
    cleanups.push(() => proxy.stop())
    const response = await fetch(`${proxy.origin}/_api/anything`)
    await proxy.stop()
    await api.stop()

    expect(response.status).toBe(503)
    expect(api.requests).toEqual([])
  })

  test.each([
    ['1. a scenario', '01-a-scenario.json.gz'],
    ['23. Move within a group POSTs the clicked position\'s move', '23-move-within-a-group-posts-the-clicked-position-s-move.json.gz'],
    [`12. ${'x'.repeat(80)}`, `12-${'x'.repeat(60)}.json.gz`],
  ])('names the rehearsal for "%s" by number and slug', (title, file) => {
    expect(rehearsalFileName(title)).toBe(file)
  })
})
