// @vitest-environment node

import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, test } from 'vitest'
import { requestPage, resolvePageCacheWarmSettings, warmPages } from './page-cache-warm'

interface Received {
  path: string
  headers: http.IncomingHttpHeaders
}

async function startOrigin(respond: (req: http.IncomingMessage, res: http.ServerResponse) => void) {
  const received: Received[] = []
  const server = http.createServer((req, res) => {
    received.push({ path: req.url!, headers: req.headers })
    respond(req, res)
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  servers.push(server)
  return { origin, received }
}

const servers: http.Server[] = []

afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
})

describe('requestPage', () => {
  test('sends the public host rather than the origin it connects to', async () => {
    const { origin, received } = await startOrigin((_req, res) => res.end('ok'))

    await requestPage({ origin, path: '/about', host: 'www.example.com', headers: {}, timeout: 1000 })

    expect(received).toHaveLength(1)
    expect(received[0]!.path).toBe('/about')
    expect(received[0]!.headers.host).toBe('www.example.com')
  })

  test('sends only the headers it is given, with no cookie or authorization', async () => {
    const { origin, received } = await startOrigin((_req, res) => res.end('ok'))

    await requestPage({
      origin,
      path: '/',
      host: 'www.example.com',
      headers: { 'accept': 'text/html', 'accept-encoding': 'gzip, br' },
      timeout: 1000,
    })

    expect(received[0]!.headers.accept).toBe('text/html')
    expect(received[0]!.headers['accept-encoding']).toBe('gzip, br')
    expect(received[0]!.headers.cookie).toBeUndefined()
    expect(received[0]!.headers.authorization).toBeUndefined()
  })

  test('resolves with the status once the whole body has been read', async () => {
    const { origin } = await startOrigin((_req, res) => {
      res.write('<html>')
      setTimeout(() => res.end('</html>'), 20)
    })

    await expect(requestPage({ origin, path: '/', host: 'www.example.com', headers: {}, timeout: 1000 }))
      .resolves.toEqual({ path: '/', status: 200 })
  })

  test('does not follow a redirect and reports its status', async () => {
    const { origin, received } = await startOrigin((req, res) => {
      if (req.url === '/old') {
        res.writeHead(301, { location: '/new' })
      }
      res.end()
    })

    await expect(requestPage({ origin, path: '/old', host: 'www.example.com', headers: {}, timeout: 1000 }))
      .resolves.toEqual({ path: '/old', status: 301 })
    expect(received.map(r => r.path)).toEqual(['/old'])
  })

  test('reports a page that does not answer within the timeout as timed out', async () => {
    const { origin } = await startOrigin(() => {})

    await expect(requestPage({ origin, path: '/slow', host: 'www.example.com', headers: {}, timeout: 50 }))
      .resolves.toEqual({ path: '/slow', status: 0, error: 'timeout' })
  })

  test('reports a page whose origin refuses the connection as having no response', async () => {
    const { origin } = await startOrigin((_req, res) => res.end())
    servers[0]!.closeAllConnections()
    await new Promise(resolve => servers.splice(0)[0]!.close(resolve))

    await expect(requestPage({ origin, path: '/', host: 'www.example.com', headers: {}, timeout: 1000 }))
      .resolves.toEqual({ path: '/', status: 0, error: 'network' })
  })
})

describe('warmPages', () => {
  function heldRequests() {
    const pending: { path: string, release: (status?: number) => void }[] = []
    let inFlight = 0
    let maxInFlight = 0
    const request = (path: string) => new Promise<{ path: string, status: number }>((resolve) => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      pending.push({
        path,
        release: (status = 200) => {
          inFlight--
          resolve({ path, status })
        },
      })
    })
    return { pending, request, maxInFlight: () => maxInFlight }
  }

  const tick = () => new Promise(resolve => setTimeout(resolve, 0))

  test('never has more requests in flight than the concurrency', async () => {
    const held = heldRequests()
    const paths = ['/a', '/b', '/c', '/d', '/e']
    const done = warmPages({ paths, concurrency: 2, request: held.request })

    for (let i = 0; i < paths.length; i++) {
      await tick()
      held.pending.shift()!.release()
    }
    await done

    expect(held.maxInFlight()).toBe(2)
  })

  test('reports each page as it completes, in completion order', async () => {
    const held = heldRequests()
    const reported: [string, number][] = []
    const done = warmPages({
      paths: ['/a', '/b'],
      concurrency: 2,
      request: held.request,
      onResult: (result, completed) => reported.push([result.path, completed]),
    })

    await tick()
    held.pending[1]!.release()
    await tick()
    expect(reported).toEqual([['/b', 1]])
    held.pending[0]!.release()
    await done

    expect(reported).toEqual([['/b', 1], ['/a', 2]])
  })

  test('starts no further pages once the signal is aborted', async () => {
    const held = heldRequests()
    const controller = new AbortController()
    const done = warmPages({ paths: ['/a', '/b', '/c'], concurrency: 1, request: held.request, signal: controller.signal })

    await tick()
    controller.abort()
    held.pending[0]!.release()
    await done

    expect(held.pending.map(p => p.path)).toEqual(['/a'])
  })
})

describe('resolvePageCacheWarmSettings', () => {
  test('defaults to three at a time, a 30 second page timeout and the API URL origin', () => {
    expect(resolvePageCacheWarmSettings({ apiUrl: 'http://cwa/_api' })).toEqual({
      origin: 'http://cwa',
      concurrency: 3,
      timeout: 30000,
    })
  })

  test('falls back to the browser API URL when there is no server API URL', () => {
    expect(resolvePageCacheWarmSettings({ apiUrl: '', apiUrlBrowser: 'https://www.example.com/_api' }).origin)
      .toBe('https://www.example.com')
  })

  test('prefers a configured origin over the API URL', () => {
    expect(resolvePageCacheWarmSettings({ apiUrl: 'http://cwa/_api', pageCacheWarm: { origin: 'http://caddy:8080/ignored' } }).origin)
      .toBe('http://caddy:8080')
  })

  test('caps the concurrency at 10', () => {
    expect(resolvePageCacheWarmSettings({ apiUrl: 'http://cwa', pageCacheWarm: { concurrency: 50 } }).concurrency).toBe(10)
  })

  test('accepts numeric strings from environment variables', () => {
    expect(resolvePageCacheWarmSettings({ apiUrl: 'http://cwa', pageCacheWarm: { concurrency: '5', timeout: '10000' } }))
      .toMatchObject({ concurrency: 5, timeout: 10000 })
  })

  test('uses the defaults for values that are not positive numbers', () => {
    expect(resolvePageCacheWarmSettings({ apiUrl: 'http://cwa', pageCacheWarm: { concurrency: 0, timeout: 'soon' } }))
      .toMatchObject({ concurrency: 3, timeout: 30000 })
  })
})
