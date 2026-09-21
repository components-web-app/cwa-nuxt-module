// @vitest-environment node

import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { createApp, toNodeListener } from 'h3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const { mockFetcher, mockUsePageCacheWarmSettings } = vi.hoisted(() => ({
  mockFetcher: vi.fn(),
  mockUsePageCacheWarmSettings: vi.fn(),
}))

vi.mock('./useFetcher', () => ({
  default: () => ({ fetcher: mockFetcher }),
}))

vi.mock('./page-cache-warm-config', () => ({
  usePageCacheWarmSettings: mockUsePageCacheWarmSettings,
}))

interface OriginRequest {
  path: string
  headers: http.IncomingHttpHeaders
  release: (status?: number) => void
}

const servers: http.Server[] = []

async function listen(listener: http.RequestListener) {
  const server = http.createServer(listener)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  servers.push(server)
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

let origin: string
let originRequests: OriginRequest[]
let holdPaths: Set<string>
let statuses: Record<string, number>
let handlerUrl: string

function adminSession(roles = ['ROLE_USER', 'ROLE_ADMIN']) {
  mockFetcher.mockImplementation(async (url: string) => {
    if (url === '/me') {
      return { roles }
    }
    if (url === '/_/routes?pagination=false') {
      return { member: pagesList.map(path => ({ path, page: '/_/pages/x' })) }
    }
    throw new Error(`unexpected ${url}`)
  })
}

let pagesList: string[]

function postWarm(headers: Record<string, string> = { cookie: 'api_component=jwt; cwa_auth=1' }) {
  const controller = new AbortController()
  const response = new Promise<http.IncomingMessage>((resolve, reject) => {
    const request = http.request(handlerUrl, { method: 'POST', headers, signal: controller.signal }, resolve)
    request.on('error', reject)
    request.end()
  })
  return { response, abort: () => controller.abort() }
}

async function* lines(response: http.IncomingMessage) {
  let buffer = ''
  for await (const chunk of response) {
    buffer += chunk
    let index
    while ((index = buffer.indexOf('\n')) >= 0) {
      yield JSON.parse(buffer.slice(0, index))
      buffer = buffer.slice(index + 1)
    }
  }
}

async function readAll(response: http.IncomingMessage) {
  const all = []
  for await (const line of lines(response)) {
    all.push(line)
  }
  return all
}

async function readBody(response: http.IncomingMessage) {
  let body = ''
  for await (const chunk of response) {
    body += chunk
  }
  return body
}

function originRequest(path: string) {
  return originRequests.find(r => r.path === path)
}

beforeEach(async () => {
  vi.resetModules()
  mockFetcher.mockReset()
  mockUsePageCacheWarmSettings.mockReset()
  originRequests = []
  holdPaths = new Set()
  statuses = {}
  pagesList = ['/', '/about']

  origin = await listen((req, res) => {
    const release = (status = statuses[req.url!] ?? 200) => {
      res.statusCode = status
      res.end('<html></html>')
    }
    originRequests.push({ path: req.url!, headers: req.headers, release })
    if (!holdPaths.has(req.url!)) {
      release()
    }
  })
  mockUsePageCacheWarmSettings.mockReturnValue({ origin, concurrency: 3, timeout: 1000 })

  const handler = (await import('./cwa-page-cache-warm.post')).default
  const app = createApp()
  app.use('/_cwa/page-cache/warm', handler)
  handlerUrl = `${await listen(toNodeListener(app))}/_cwa/page-cache/warm`
})

afterEach(async () => {
  for (const request of originRequests) {
    request.release()
  }
  for (const server of servers.splice(0)) {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
})

describe('POST /_cwa/page-cache/warm admin gate', () => {
  test('refuses a request with no session, without fetching anything', async () => {
    adminSession()
    const response = await postWarm({}).response

    expect(response.statusCode).toBe(403)
    expect(mockFetcher).not.toHaveBeenCalled()
    expect(originRequests).toHaveLength(0)
  })

  test('checks the session against the API with the incoming cookie', async () => {
    adminSession()
    const response = await postWarm().response
    await readAll(response)

    expect(mockFetcher).toHaveBeenCalledWith('/me', expect.objectContaining({ headers: { cookie: 'api_component=jwt; cwa_auth=1' } }))
  })

  test('refuses a signed-in user without an admin role, fetching no page list and no pages', async () => {
    adminSession(['ROLE_USER'])
    const response = await postWarm().response

    expect(response.statusCode).toBe(403)
    expect(mockFetcher).toHaveBeenCalledTimes(1)
    expect(mockFetcher.mock.calls[0]![0]).toBe('/me')
    expect(originRequests).toHaveLength(0)
  })

  test('refuses a session the API rejects', async () => {
    mockFetcher.mockRejectedValue(Object.assign(new Error('Unauthorized'), { statusCode: 401 }))
    const response = await postWarm().response

    expect(response.statusCode).toBe(403)
    expect(originRequests).toHaveLength(0)
  })

  test('accepts a super admin', async () => {
    adminSession(['ROLE_SUPER_ADMIN'])
    const response = await postWarm().response
    await readAll(response)

    expect(response.statusCode).toBe(200)
  })
})

describe('POST /_cwa/page-cache/warm warming', () => {
  test('uses the settings from runtime config', async () => {
    adminSession()
    await readAll(await postWarm().response)

    expect(mockUsePageCacheWarmSettings).toHaveBeenCalled()
    expect(originRequests.map(r => r.path).sort()).toEqual(['/', '/about'])
  })

  test('requests every page anonymously on the host the admin is using, with their accept headers', async () => {
    adminSession()
    await readAll(await postWarm({
      'cookie': 'api_component=jwt; cwa_auth=1',
      'authorization': 'Bearer secret',
      'host': 'www.example.com',
      'accept': 'text/html',
      'accept-encoding': 'gzip, br',
    }).response)

    expect(originRequests).toHaveLength(2)
    for (const request of originRequests) {
      expect(request.headers.host).toBe('www.example.com')
      expect(request.headers.cookie).toBeUndefined()
      expect(request.headers.authorization).toBeUndefined()
      expect(request.headers.accept).toBe('text/html')
      expect(request.headers['accept-encoding']).toBe('gzip, br')
    }
  })

  test('uses the forwarded host when the request came through a proxy', async () => {
    adminSession()
    await readAll(await postWarm({
      'cookie': 'api_component=jwt',
      'host': 'cwa-pwa:3000',
      'x-forwarded-host': 'www.example.com',
    }).response)

    expect(originRequests[0]!.headers.host).toBe('www.example.com')
  })

  test('streams NDJSON with a start line, a line per page and a summary', async () => {
    adminSession()
    const response = await postWarm().response

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toBe('application/x-ndjson')
    expect(response.headers['x-accel-buffering']).toBe('no')
    expect(response.headers['cache-control']).toBe('no-store')

    const all = await readAll(response)
    expect(all[0]).toEqual({ type: 'start', total: 2 })
    expect(all.slice(1, 3)).toEqual(expect.arrayContaining([
      { type: 'page', path: '/', status: 200, completed: expect.any(Number), total: 2 },
      { type: 'page', path: '/about', status: 200, completed: expect.any(Number), total: 2 },
    ]))
    expect(all[3]).toEqual({ type: 'done', total: 2, warmed: 2, failed: [] })
  })

  test('sends each page line as that page completes, while others are still loading', async () => {
    adminSession()
    mockUsePageCacheWarmSettings.mockReturnValue({ origin, concurrency: 3, timeout: 60000 })
    holdPaths.add('/about')
    const response = await postWarm().response
    const reader = lines(response)

    expect((await reader.next()).value).toEqual({ type: 'start', total: 2 })
    expect((await reader.next()).value).toMatchObject({ type: 'page', path: '/', status: 200, completed: 1 })
    expect(originRequest('/about')).toBeDefined()

    originRequest('/about')!.release()
    expect((await reader.next()).value).toMatchObject({ type: 'page', path: '/about', status: 200, completed: 2 })
  })

  test('counts only 200s as warmed, reporting redirects and errors as failures', async () => {
    adminSession()
    pagesList = ['/', '/missing', '/moved']
    statuses = { '/missing': 404, '/moved': 301 }
    const all = await readAll(await postWarm().response)

    expect(all.at(-1)).toEqual({
      type: 'done',
      total: 3,
      warmed: 1,
      failed: expect.arrayContaining([
        { path: '/missing', status: 404 },
        { path: '/moved', status: 301 },
      ]),
    })
  })

  test('reports a page that times out', async () => {
    adminSession()
    mockUsePageCacheWarmSettings.mockReturnValue({ origin, concurrency: 3, timeout: 50 })
    holdPaths.add('/about')
    const all = await readAll(await postWarm().response)

    expect(all.at(-1)).toMatchObject({ warmed: 1, failed: [{ path: '/about', status: 0, error: 'timeout' }] })
  })

  test('never has more pages loading than the configured concurrency', async () => {
    adminSession()
    pagesList = ['/a', '/b', '/c', '/d']
    holdPaths = new Set(pagesList)
    mockUsePageCacheWarmSettings.mockReturnValue({ origin, concurrency: 2, timeout: 1000 })
    const response = await postWarm().response
    const done = readAll(response)

    await vi.waitFor(() => expect(originRequests).toHaveLength(2))
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(originRequests).toHaveLength(2)

    originRequests[0]!.release()
    await vi.waitFor(() => expect(originRequests).toHaveLength(3))
    originRequests[1]!.release()
    originRequests[2]!.release()
    await vi.waitFor(() => expect(originRequests).toHaveLength(4))
    originRequests[3]!.release()

    expect((await done).at(-1)).toMatchObject({ total: 4, warmed: 4 })
  })

  test('warms nothing and reports an empty summary when there are no pages', async () => {
    adminSession()
    pagesList = []
    const all = await readAll(await postWarm().response)

    expect(all).toEqual([{ type: 'start', total: 0 }, { type: 'done', total: 0, warmed: 0, failed: [] }])
  })

  test('responds 502 when the page list cannot be loaded, and allows another warm afterwards', async () => {
    adminSession()
    const original = mockFetcher.getMockImplementation()!
    mockFetcher.mockImplementation(async (url: string, ops?: unknown) => {
      if (url === '/_/routes?pagination=false') {
        throw new Error('API down')
      }
      return original(url, ops)
    })
    const failed = await postWarm().response
    await readBody(failed)

    expect(failed.statusCode).toBe(502)

    adminSession()
    const next = await postWarm().response
    await readAll(next)
    expect(next.statusCode).toBe(200)
  })

  test('requests the page list with a 30 second timeout', async () => {
    adminSession()
    await readAll(await postWarm().response)

    expect(mockFetcher).toHaveBeenCalledWith('/_/routes?pagination=false', { timeout: 30000 })
  })
})

describe('POST /_cwa/page-cache/warm single flight', () => {
  test('refuses a second warm while one is running', async () => {
    adminSession()
    holdPaths.add('/about')
    const first = await postWarm().response
    const firstLines = readAll(first)
    await vi.waitFor(() => expect(originRequest('/about')).toBeDefined())

    const second = await postWarm().response
    await readBody(second)
    expect(second.statusCode).toBe(409)

    originRequest('/about')!.release()
    expect((await firstLines).at(-1)).toMatchObject({ type: 'done', warmed: 2 })
  })

  test('allows a new warm once the previous one has finished', async () => {
    adminSession()
    await readAll(await postWarm().response)
    const again = await postWarm().response
    await readAll(again)

    expect(again.statusCode).toBe(200)
  })

  test('stops requesting pages when the admin disconnects, and frees the lock', async () => {
    adminSession()
    pagesList = ['/a', '/b', '/c']
    holdPaths = new Set(['/a'])
    mockUsePageCacheWarmSettings.mockReturnValue({ origin, concurrency: 1, timeout: 1000 })
    const warm = postWarm()
    const response = await warm.response
    response.on('error', () => {})
    await vi.waitFor(() => expect(originRequest('/a')).toBeDefined())

    warm.abort()
    await new Promise(resolve => setTimeout(resolve, 50))
    originRequest('/a')!.release()
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(originRequests.map(r => r.path)).toEqual(['/a'])

    pagesList = []
    const next = await postWarm().response
    await readAll(next)
    expect(next.statusCode).toBe(200)
  })
})
