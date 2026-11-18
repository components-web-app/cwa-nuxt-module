// @vitest-environment nuxt
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { useListRoutes } from './useListRoutes'
import { consola } from 'consola'
import * as cwaComposable from '#cwa/composables/cwa'

function mockFetch(...responses: Array<Promise<unknown>>) {
  const fetchMock = vi.fn()
  for (const response of responses) {
    fetchMock.mockReturnValueOnce({ response })
  }
  // @ts-expect-error partial mock
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({ fetch: fetchMock }))
  return fetchMock
}

const pages = [
  { '@id': '/_/pages/a', 'route': '/_/routes//a' },
  { '@id': '/_/pages/b' },
  { '@id': '/_/pages/c', 'route': '/_/routes//c' },
] as any[]

describe('useListRoutes (#461)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('reads the routes of the routed pages on screen in one request (api-components-bundle#590)', async () => {
    const fetchMock = mockFetch(Promise.resolve({ _data: { member: [] } }))
    const { load } = useListRoutes('pages')

    await load(pages)

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith({ path: '/_/routes?pages%5B%5D=%2F_%2Fpages%2Fa&pages%5B%5D=%2F_%2Fpages%2Fc&perPage=100', noQuery: true })
  })

  test('page data is filtered and keyed by its own property', async () => {
    const route = { '@id': '/_/routes//a', 'pageData': '/page_data/a', 'path': '/a' }
    const fetchMock = mockFetch(Promise.resolve({ _data: { member: [route] } }))
    const { routes, load } = useListRoutes('pageData')

    await load([{ '@id': '/page_data/a', 'route': '/_/routes//a' }] as any[])

    expect(fetchMock.mock.calls[0]![0].path).toBe('/_/routes?pageData%5B%5D=%2Fpage_data%2Fa&perPage=100')
    expect(routes.value).toEqual({ '/page_data/a': route })
  })

  test('keys each route by the page it routes, and is known once read', async () => {
    const routeA = { '@id': '/_/routes//a', 'page': '/_/pages/a', 'path': '/a' }
    mockFetch(Promise.resolve({ _data: { member: [routeA] } }))
    const { routes, known, load } = useListRoutes('pages')

    await load([{ '@id': '/_/pages/b' }] as any[])
    expect(known.value).toBe(true)
    const loading = load(pages)
    expect(known.value).toBe(false)
    await loading

    expect(routes.value).toEqual({ '/_/pages/a': routeA })
    expect(known.value).toBe(true)
  })

  test('a list with no routed page asks for nothing and is known at once', async () => {
    const fetchMock = mockFetch()
    const { routes, known, load } = useListRoutes('pages')

    await load([{ '@id': '/_/pages/b' }] as any[])

    expect(fetchMock).not.toHaveBeenCalled()
    expect(routes.value).toEqual({})
    expect(known.value).toBe(true)
  })

  test('a failed read leaves the routes unknown, says why and logs it, and Retry reads the same pages again', async () => {
    const logged = vi.spyOn(consola, 'error').mockImplementation(() => undefined)
    const offline = new Error('offline')
    const routeA = { '@id': '/_/routes//a', 'page': '/_/pages/a', 'path': '/a' }
    const fetchMock = mockFetch(Promise.reject(offline), Promise.resolve({ _data: { member: [routeA] } }))
    const { known, error, routes, load, retry } = useListRoutes('pages')

    await load(pages)

    expect(known.value).toBe(false)
    expect(error.value).toBe(offline)
    expect(logged).toHaveBeenCalledWith('[CWA] Could not load the routes of the list', offline)

    const retrying = retry()
    expect(error.value).toBeUndefined()
    await retrying
    expect(fetchMock.mock.calls[1]![0]).toEqual(fetchMock.mock.calls[0]![0])
    expect(routes.value).toEqual({ '/_/pages/a': routeA })
    expect(known.value).toBe(true)
  })

  test('an older answer never replaces a newer one', async () => {
    let resolveOlder: (value: unknown) => void = () => {}
    const older = new Promise((resolve) => {
      resolveOlder = resolve
    })
    const newer = { '@id': '/_/routes//c', 'page': '/_/pages/c', 'path': '/c' }
    mockFetch(older, Promise.resolve({ _data: { member: [newer] } }))
    const { routes, load } = useListRoutes('pages')

    const first = load(pages)
    await load(pages)
    resolveOlder({ _data: { member: [{ '@id': '/_/routes//a', 'page': '/_/pages/a', 'path': '/a' }] } })
    await first

    expect(routes.value).toEqual({ '/_/pages/c': newer })
  })
})
