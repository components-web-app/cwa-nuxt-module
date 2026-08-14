// @vitest-environment node

import { describe, expect, test, vi, beforeEach } from 'vitest'

const mockFetcher = vi.fn()
const mockResolveConfigEventHandler = vi.fn()

vi.mock('#sitemap/server/composables/defineSitemapEventHandler', () => ({
  defineSitemapEventHandler: (fn: any) => fn,
}))

vi.mock('./useFetcher', () => ({
  default: () => ({ fetcher: mockFetcher }),
  resolveConfigEventHandler: (...args: any[]) => mockResolveConfigEventHandler(...args),
}))

const importHandler = async () => (await import('./cwa-urls.get')).default

const collection = (members: any[]) => ({ member: members })

const route = (path: string, extra: Record<string, any> = {}) => ({
  '@id': `/_/routes/${path}`,
  '@type': 'Route',
  path,
  ...extra,
})

describe('cwa-urls sitemap source', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveConfigEventHandler.mockResolvedValue({ sitemapEnabled: true })
  })

  test('returns nothing when there is no resolved config', async () => {
    mockResolveConfigEventHandler.mockResolvedValue(undefined)
    const handler = await importHandler()

    await expect(handler({} as any)).resolves.toEqual([])
    expect(mockFetcher).not.toHaveBeenCalled()
  })

  test('returns nothing when the sitemap is disabled', async () => {
    mockResolveConfigEventHandler.mockResolvedValue({ sitemapEnabled: false })
    const handler = await importHandler()

    await expect(handler({} as any)).resolves.toEqual([])
    expect(mockFetcher).not.toHaveBeenCalled()
  })

  test('fetches every route without pagination and emits the paths', async () => {
    mockFetcher.mockResolvedValue(collection([
      route('/', { page: '/_/pages/home' }),
      route('/blog/my-post', { pageData: '/page_data/blog_pages/abc' }),
    ]))
    const handler = await importHandler()

    await expect(handler({} as any)).resolves.toEqual([
      { loc: '/' },
      { loc: '/blog/my-post' },
    ])
    expect(mockFetcher).toHaveBeenCalledWith('/_/routes?pagination=false')
  })

  test('excludes a redirect route even though the API propagates the target page onto it', async () => {
    // RouteNormalizer copies the final route's page/pageData onto a redirect route when
    // serialising, so a redirect can carry a `page` - only `redirect` proves it is a redirect.
    mockFetcher.mockResolvedValue(collection([
      route('/topic-1', {
        redirect: '/_/routes//topic-1/chapter-one',
        redirectPath: '/topic-1/chapter-one',
        page: '/_/pages/ac96cf91',
        pageData: '/page_data/nested_page_datas/44a4846b',
      }),
      route('/topic-1/chapter-one', { page: '/_/pages/ac96cf91' }),
    ]))
    const handler = await importHandler()

    await expect(handler({} as any)).resolves.toEqual([{ loc: '/topic-1/chapter-one' }])
  })

  test('excludes a route whose only redirect evidence is redirectPath', async () => {
    mockFetcher.mockResolvedValue(collection([
      route('/old', { redirectPath: '/new', page: '/_/pages/new' }),
      route('/new', { page: '/_/pages/new' }),
    ]))
    const handler = await importHandler()

    await expect(handler({} as any)).resolves.toEqual([{ loc: '/new' }])
  })

  test('excludes a route with neither page nor pageData', async () => {
    mockFetcher.mockResolvedValue(collection([
      route('/orphan'),
      route('/real', { page: '/_/pages/real' }),
    ]))
    const handler = await importHandler()

    await expect(handler({} as any)).resolves.toEqual([{ loc: '/real' }])
  })

  test('keeps every route when no member exposes page or pageData at all', async () => {
    // A shallower collection serialisation must never silently empty the sitemap - with no
    // positive evidence that the fields exist we cannot judge, so we include.
    mockFetcher.mockResolvedValue(collection([
      route('/one'),
      route('/two'),
    ]))
    const handler = await importHandler()

    await expect(handler({} as any)).resolves.toEqual([
      { loc: '/one' },
      { loc: '/two' },
    ])
  })

  test('still excludes redirects when page/pageData are not exposed', async () => {
    mockFetcher.mockResolvedValue(collection([
      route('/old', { redirect: '/_/routes//new' }),
      route('/new'),
    ]))
    const handler = await importHandler()

    await expect(handler({} as any)).resolves.toEqual([{ loc: '/new' }])
  })

  test('skips members without a usable path', async () => {
    mockFetcher.mockResolvedValue(collection([
      { '@id': '/_/routes/no-path', '@type': 'Route', 'page': '/_/pages/x' },
      route('', { page: '/_/pages/y' }),
      route('/good', { page: '/_/pages/z' }),
    ]))
    const handler = await importHandler()

    await expect(handler({} as any)).resolves.toEqual([{ loc: '/good' }])
  })
})
