import { afterEach, describe, expect, test, vi } from 'vitest'
import { fetchTemplateCounts, pageDeleteConfirmLines, pageDeleteLines } from './page-delete'

const template = '/_/pages/template'

function fakeCwa(responses: Record<string, unknown>) {
  return {
    fetch: vi.fn(({ path }: { path: string }) => ({
      response: path in responses
        ? Promise.resolve({ _data: responses[path] })
        : Promise.reject(Object.assign(new Error('not found'), { statusCode: 404 })),
    })),
  }
}

describe('what deleting a page does (#461)', () => {
  test('a template states its cascade first, in bold, then what is kept, muted', () => {
    expect(pageDeleteLines({ template: true, templatePages: 14, addresses: 14, hasRoute: true, routePath: '/kitchens/shaker', nested: 2 })).toEqual([
      { text: '14 pages built from this template are deleted too. Visitors to their 14 addresses get “Page not found”.', emphasis: 'strong' },
      { text: 'The route /kitchens/shaker is kept, and visitors to it get “Page not found”. The 2 pages nested under it are kept and lose their parent.', emphasis: 'muted' },
    ])
  })

  test.each([
    [{ templatePages: 1, addresses: 1 }, '1 page built from this template is deleted too. Visitors to their 1 address get “Page not found”.'],
    [{ templatePages: 3, addresses: 0 }, '3 pages built from this template are deleted too.'],
    [{ templatePages: 3, addresses: undefined }, '3 pages built from this template are deleted too, and their addresses stop showing a page.'],
    [{ templatePages: undefined, addresses: undefined }, 'Pages built from this template are deleted too, and their addresses stop showing a page.'],
  ])('a template with %o says “%s”', (counts, text) => {
    expect(pageDeleteLines({ template: true, hasRoute: false, ...counts })[0]).toEqual({ text, emphasis: 'strong' })
  })

  test('an unused template, or a page that is not one, says nothing about a cascade', () => {
    expect(pageDeleteLines({ template: true, templatePages: 0, addresses: 0, hasRoute: false })).toEqual([])
    expect(pageDeleteLines({ template: false, templatePages: 5, hasRoute: false })).toEqual([])
  })

  test('the route sentence appears only when there is a route, and names it when known', () => {
    expect(pageDeleteLines({ template: false, hasRoute: true })).toEqual([{ text: 'Its route is kept, and visitors to it get “Page not found”.', emphasis: 'muted' }])
    expect(pageDeleteLines({ template: false, hasRoute: false, nested: 1 })).toEqual([{ text: 'The page nested under it is kept and loses its parent.', emphasis: 'muted' }])
  })

  test('the confirm adds the unsaved changes and that it cannot be undone, last', () => {
    expect(pageDeleteConfirmLines({ template: false, hasRoute: false }, 3)).toEqual([
      { text: 'Your 3 unsaved changes are discarded too.' },
      { text: 'This can\'t be undone.' },
    ])
    expect(pageDeleteConfirmLines({ template: false, hasRoute: false }, 0)).toEqual([{ text: 'This can\'t be undone.' }])
  })
})

describe('fetching the template counts (#461)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  test('re-fetches the page for its count, finds its pages and counts their routes in one request', async () => {
    const $cwa = fakeCwa({
      [template]: { _metadata: { pageDataCount: 2 } },
      '/page_data/articles?perPage=100': { member: [{ '@id': '/page_data/articles/1', 'page': template }, { '@id': '/page_data/articles/2', 'page': '/_/pages/other' }] },
      '/page_data/events?perPage=100': { member: [{ '@id': '/page_data/events/9', 'page': template }] },
      '/_/routes?pageData%5B%5D=%2Fpage_data%2Farticles%2F1&pageData%5B%5D=%2Fpage_data%2Fevents%2F9&perPage=100': { totalItems: 1, member: [{}] },
    })

    expect(await fetchTemplateCounts($cwa as any, template, ['/page_data/articles', '/page_data/events'])).toEqual({ templatePages: 2, addresses: 1 })
    expect($cwa.fetch).toHaveBeenCalledWith({ path: template, noQuery: true })
  })

  test('an unused template asks for nothing more', async () => {
    const $cwa = fakeCwa({ [template]: { _metadata: { pageDataCount: 0 } } })

    expect(await fetchTemplateCounts($cwa as any, template, ['/page_data/articles'])).toEqual({ templatePages: 0, addresses: 0 })
    expect($cwa.fetch).toHaveBeenCalledOnce()
  })

  test('when not every built page is found the address count is unknown, never a wrong number', async () => {
    const $cwa = fakeCwa({
      [template]: { _metadata: { pageDataCount: 3 } },
      '/page_data/articles?perPage=100': { member: [{ '@id': '/page_data/articles/1', 'page': template }] },
      '/_/routes?pageData%5B%5D=%2Fpage_data%2Farticles%2F1&perPage=100': { totalItems: 1 },
    })

    expect(await fetchTemplateCounts($cwa as any, template, ['/page_data/articles'])).toEqual({ templatePages: 3, addresses: undefined })
  })

  test('a failure leaves both counts unknown', async () => {
    expect(await fetchTemplateCounts(fakeCwa({}) as any, template, [])).toEqual({})
  })

  test('after 3 s the counts are unknown', async () => {
    vi.useFakeTimers()
    const $cwa = { fetch: vi.fn(() => ({ response: new Promise(() => {}) })) }

    const counts = fetchTemplateCounts($cwa as any, template, [])
    vi.advanceTimersByTime(3000)

    expect(await counts).toEqual({})
  })
})
