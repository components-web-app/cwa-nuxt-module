// @vitest-environment nuxt
import { describe, test, expect, vi, afterEach } from 'vitest'
import { computed, effectScope, reactive } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { useRouteDefaults } from './route-defaults'
import * as cwaComposable from '#cwa/composables/cwa'

const announcementsIri = '/_/page_data/announcement_datas/a1'

function mockCwa(supportedClass: Record<string, any>[], store: Record<string, any> = {}) {
  const resources = reactive<Record<string, any>>(store)
  const getApiDocumentation = vi.fn().mockResolvedValue({ docs: { supportedClass } })
  // @ts-expect-error
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    resources: { getResource: vi.fn((iri: string) => computed(() => resources[iri])) },
    fetchResource: vi.fn(),
    getApiDocumentation,
  }))
  return { getApiDocumentation }
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

describe('useRouteDefaults (api-components-bundle#601)', () => {
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

  test('a class without a routePrefix locks nothing and recommends as before', async () => {
    mockCwa([{ title: 'AnnouncementData' }], {
      [announcementsIri]: { data: { '@id': announcementsIri, 'route': '/_/routes//announcements/summer-fair' } },
    })
    const result = await defaults({ title: 'Gates Open', parentPageData: announcementsIri }, 'UpdateData')
    expect(result.lockedPrefix.value).toBeUndefined()
    expect(result.recommendedPath.value).toBe('/announcements/summer-fair/gates-open')
  })

  test.each([[''], ['/'], ['announcements'], ['/announcements/'], [42]])('a routePrefix of %j is invalid configuration and locks nothing', async (routePrefix) => {
    mockCwa([{ title: 'AnnouncementData', routePrefix }])
    const result = await defaults({ title: 'Summer Fair' }, 'AnnouncementData')
    expect(result.lockedPrefix.value).toBeUndefined()
    expect(result.recommendedPath.value).toBe('/summer-fair')
  })
})
