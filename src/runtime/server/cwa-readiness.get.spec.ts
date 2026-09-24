// @vitest-environment node

import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { $fetch } from 'ofetch'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const { mockUseReadinessSettings, mockSetResponseHeaders, mockSetResponseStatus, mockConsola } = vi.hoisted(() => ({
  mockUseReadinessSettings: vi.fn(),
  mockSetResponseHeaders: vi.fn(),
  mockSetResponseStatus: vi.fn(),
  mockConsola: { warn: vi.fn(), error: vi.fn() },
}))

vi.mock('h3', () => ({
  defineEventHandler: (fn: any) => fn,
  setResponseHeaders: (...args: any[]) => mockSetResponseHeaders(...args),
  setResponseStatus: (...args: any[]) => mockSetResponseStatus(...args),
}))

vi.mock('consola', () => ({ consola: mockConsola }))

vi.mock('./readiness-config', () => ({
  useReadinessSettings: () => mockUseReadinessSettings(),
}))

vi.mock('./useFetcher', () => ({
  default: () => ({ fetcher: $fetch.create({ baseURL: origin }) }),
}))

const servers: http.Server[] = []
let origin: string
let respond: http.RequestListener

async function startApi() {
  const server = http.createServer((request, response) => respond(request, response))
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  servers.push(server)
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

const importHandler = async () => (await import('./cwa-readiness.get')).default

async function probe(timeout = 2000) {
  mockUseReadinessSettings.mockReturnValue({ path: '/_/health', timeout, url: `${origin}/_/health` })
  const handler = await importHandler()
  return handler({} as any)
}

describe('the readiness route', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await startApi()
  })

  afterEach(async () => {
    await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))))
  })

  test('is ready when the API answers', async () => {
    respond = (_request, response) => response.writeHead(200).end('{}')

    await expect(probe()).resolves.toEqual({ status: 'OK' })
    expect(mockSetResponseStatus).not.toHaveBeenCalled()
    expect(mockConsola.warn).not.toHaveBeenCalled()
  })

  test('is not ready when the API fails, and says nothing about the API in the response', async () => {
    respond = (_request, response) => response.writeHead(503).end('down')

    await expect(probe()).resolves.toEqual({ status: 'UNAVAILABLE' })
    expect(mockSetResponseStatus).toHaveBeenCalledWith({}, 503)
    expect(JSON.stringify(await probe())).not.toContain(origin)
  })

  test('logs the url tried and the status when the API fails', async () => {
    respond = (_request, response) => response.writeHead(502).end('bad gateway')

    await probe()

    expect(mockConsola.error).toHaveBeenCalledWith(expect.stringContaining(`${origin}/_/health`))
    expect(mockConsola.error).toHaveBeenCalledWith(expect.stringContaining('502'))
  })

  test('does not follow a redirect, and reports where it was sent', async () => {
    respond = (_request, response) => response.writeHead(308, { location: 'https://elsewhere.example.com/_/health' }).end()

    await expect(probe()).resolves.toEqual({ status: 'UNAVAILABLE' })
    expect(mockConsola.error).toHaveBeenCalledWith(expect.stringContaining('https://elsewhere.example.com/_/health'))
  })

  test('is ready but warns when the API has no health endpoint', async () => {
    respond = (_request, response) => response.writeHead(404).end('{}')

    await expect(probe()).resolves.toEqual({ status: 'OK' })
    expect(mockSetResponseStatus).not.toHaveBeenCalled()
    expect(mockConsola.warn).toHaveBeenCalledWith(expect.stringContaining('404'))
  })

  test('gives up on an API that never answers', async () => {
    respond = () => {}

    await expect(probe(150)).resolves.toEqual({ status: 'UNAVAILABLE' })
    expect(mockConsola.error).toHaveBeenCalledWith(expect.stringContaining('did not respond within'))
  })

  test('is not ready when the API cannot be reached at all', async () => {
    await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))))

    await expect(probe()).resolves.toEqual({ status: 'UNAVAILABLE' })
    expect(mockConsola.error).toHaveBeenCalledWith(expect.stringContaining('could not be reached'))
  })

  test('never lets the response be cached', async () => {
    respond = (_request, response) => response.writeHead(200).end('{}')

    await probe()

    expect(mockSetResponseHeaders).toHaveBeenCalledWith({}, expect.objectContaining({ 'cache-control': 'no-store' }))
  })

  test('does not send the visitor cookie to the API', async () => {
    let received: string | undefined
    respond = (request, response) => {
      received = request.headers.cookie
      response.writeHead(200).end('{}')
    }

    await probe()

    expect(received).toBeUndefined()
  })
})
