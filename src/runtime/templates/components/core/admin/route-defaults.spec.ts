// @vitest-environment nuxt
import { describe, test, expect, vi, afterEach } from 'vitest'
import { computed, effectScope, reactive } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { useRouteDefaults } from './route-defaults'
import * as cwaComposable from '#cwa/composables/cwa'

const announcementsIri = '/_/page_data/announcement_datas/a1'

function mockCwa(supportedClass: Record<string, any>[], initial: Record<string, any> = {}) {
  const store = reactive<Record<string, any>>(initial)
  const getApiDocumentation = vi.fn().mockResolvedValue({ docs: { supportedClass } })
  const fetchResource = vi.fn()
  // @ts-expect-error
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    resources: { getResource: vi.fn((iri: string) => computed(() => store[iri])) },
    fetchResource,
    getApiDocumentation,
  }))
  return { getApiDocumentation, fetchResource, store }
}

async function defaults(page: Record<string, any>, className?: string) {
  const scope = effectScope()
  const result = scope.run(() => useRouteDefaults(() => page, className === undefined ? undefined : () => className))!
  await flushPromises()
  return result
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useRouteDefaults, a route starts with its nearest routed ancestor\'s path and its class prefix (api-components-bundle#601)', () => {
  test('a page data class with a routePrefix locks it in front of a new route and recommends the title under it', async () => {
    const { getApiDocumentation } = mockCwa([{ title: 'AnnouncementData', routePrefix: '/announcements' }])
    const result = await defaults({ title: 'Summer Fair' }, 'App\\Entity\\AnnouncementData')
    expect(getApiDocumentation).toHaveBeenCalled()
    expect(result.lockedPrefix.value).toBe('/announcements')
    expect(result.recommendedPath.value).toBe('/announcements/summer-fair')
  })

  test('the class is the page data\'s own @type when none is given', async () => {
    mockCwa([{ title: 'AnnouncementData', routePrefix: '/announcements' }])
    const result = await defaults({ '@type': 'AnnouncementData', 'title': 'Summer Fair' })
    expect(result.lockedPrefix.value).toBe('/announcements')
  })

  test('nested page data puts its class prefix after its routed parent\'s path', async () => {
    mockCwa([
      { title: 'AnnouncementData', routePrefix: '/announcements' },
      { title: 'UpdateData', routePrefix: '/updates' },
    ], {
      [announcementsIri]: { data: { '@id': announcementsIri, 'route': '/_/routes//announcements/summer-fair' } },
    })
    const result = await defaults({ title: 'Gates Open', parentPageData: announcementsIri }, 'UpdateData')
    expect(result.lockedPrefix.value).toBe('/announcements/summer-fair/updates')
    expect(result.recommendedPath.value).toBe('/announcements/summer-fair/updates/gates-open')
  })

  test('a class without a routePrefix still locks its routed parent\'s path', async () => {
    mockCwa([{ title: 'AnnouncementData' }], {
      [announcementsIri]: { data: { '@id': announcementsIri, 'route': '/_/routes//announcements/summer-fair' } },
    })
    const result = await defaults({ title: 'Gates Open', parentPageData: announcementsIri }, 'UpdateData')
    expect(result.lockedPrefix.value).toBe('/announcements/summer-fair')
    expect(result.recommendedPath.value).toBe('/announcements/summer-fair/gates-open')
  })

  test('a page under a routed parent page locks the parent\'s path, without reading the API docs', async () => {
    const { getApiDocumentation } = mockCwa([], {
      '/_/pages/about': { data: { '@id': '/_/pages/about', 'route': '/_/routes//about' } },
    })
    const result = await defaults({ '@type': 'Page', 'title': 'Our Team', 'parentPage': '/_/pages/about' })
    expect(result.lockedPrefix.value).toBe('/about')
    expect(result.recommendedPath.value).toBe('/about/our-team')
    expect(getApiDocumentation).not.toHaveBeenCalled()
  })

  test('an unrouted parent is skipped for the nearest routed ancestor, loading each one it needs', async () => {
    const { fetchResource, store } = mockCwa([], {
      '/_/pages/team': { data: { '@id': '/_/pages/team', 'parentPage': '/_/pages/about' } },
    })
    const result = await defaults({ '@type': 'Page', 'title': 'Jo', 'parentPage': '/_/pages/team' })
    expect(fetchResource).toHaveBeenCalledWith({ path: '/_/pages/about', shallowFetch: true })
    expect(result.lockedPrefix.value).toBeUndefined()

    store['/_/pages/about'] = { data: { '@id': '/_/pages/about', 'route': '/_/routes//about' } }
    await flushPromises()
    expect(result.lockedPrefix.value).toBe('/about')
    expect(result.parentHasNoRoute.value).toBe(true)
  })

  test('with no routed ancestor and no prefix, nothing is locked', async () => {
    mockCwa([], {
      '/_/pages/team': { data: { '@id': '/_/pages/team', 'parentPage': null, 'parentPageData': null } },
    })
    const result = await defaults({ '@type': 'Page', 'title': 'Jo', 'parentPage': '/_/pages/team' })
    expect(result.lockedPrefix.value).toBeUndefined()
    expect(result.recommendedPath.value).toBe('/jo')
  })

  test('a parent chain that loops ends without locking anything', async () => {
    mockCwa([], {
      '/_/pages/a': { data: { '@id': '/_/pages/a', 'parentPage': '/_/pages/b' } },
      '/_/pages/b': { data: { '@id': '/_/pages/b', 'parentPage': '/_/pages/a' } },
    })
    const result = await defaults({ '@type': 'Page', 'title': 'Jo', 'parentPage': '/_/pages/a' })
    expect(result.lockedPrefix.value).toBeUndefined()
  })

  test.each([[''], ['/'], ['announcements'], ['/announcements/'], [42]])('a routePrefix of %j is invalid configuration and locks nothing', async (routePrefix) => {
    mockCwa([{ title: 'AnnouncementData', routePrefix }])
    const result = await defaults({ title: 'Summer Fair' }, 'AnnouncementData')
    expect(result.lockedPrefix.value).toBeUndefined()
    expect(result.recommendedPath.value).toBe('/summer-fair')
  })
})
