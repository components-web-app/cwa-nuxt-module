// @vitest-environment nuxt
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { computed, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import SettingsPage from './settings.vue'
import * as cwaComposable from '#cwa/composables/cwa'
import { PageCacheWarmInterruptedError } from '#cwa/api/page-cache-warm'

const { mockOptions, mockReveal, mockPurgePageCache, mockPurgeHttpCache, mockWarmPageCache, mockFetchOrphanReport, mockRequestOrphanScan, mockFetchFileReport, mockRequestFileScan } = vi.hoisted(() => ({
  mockOptions: { pageCache: undefined as undefined | { enabled?: boolean } },
  mockReveal: vi.fn(),
  mockPurgePageCache: vi.fn(),
  mockPurgeHttpCache: vi.fn(),
  mockWarmPageCache: vi.fn(),
  mockFetchOrphanReport: vi.fn(),
  mockRequestOrphanScan: vi.fn(),
  mockFetchFileReport: vi.fn(),
  mockRequestFileScan: vi.fn(),
}))

vi.mock('#build/cwa-options', () => ({
  options: mockOptions,
  currentModulePackageInfo: { version: '1.0.0', name: '@cwa/nuxt' },
}))

vi.mock('vuejs-confirm-dialog', () => ({
  createConfirmDialog: vi.fn(() => ({ reveal: mockReveal })),
}))

const config = {
  siteName: 'Site',
  concatTitle: true,
  fallbackTitle: true,
  canonicalUrl: '',
  sitemapEnabled: true,
  sitemapXml: '',
  indexable: true,
  robotsAllowNonSeoCrawlers: true,
  robotsAllowAiBots: true,
  robotsRemoveSitemap: false,
  robotsText: '',
  maintenanceModeEnabled: false,
}

async function setup() {
  // @ts-expect-error partial mock
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    siteConfig: {
      isLoading: false,
      config,
      loadConfig: vi.fn().mockResolvedValue({ ...config }),
      totalRequests: computed(() => 0),
      apiState: { hasError: ref(false) },
      purgePageCache: mockPurgePageCache,
      purgeHttpCache: mockPurgeHttpCache,
      warmPageCache: mockWarmPageCache,
    },
    orphanedResources: {
      fetchReport: mockFetchOrphanReport,
      requestScan: mockRequestOrphanScan,
      fetchFileReport: mockFetchFileReport,
      requestFileScan: mockRequestFileScan,
    },
    getApiDocumentation: vi.fn().mockResolvedValue(undefined),
    currentModulePackageInfo: { version: '1.0.0', name: '@cwa/nuxt' },
  }))

  const wrapper = mount(SettingsPage, {
    global: {
      stubs: {
        ListHeading: true,
        MenuLink: true,
        Spinner: true,
        RouterLink: { props: ['to'], template: '<a :data-route-name="to?.name"><slot /></a>' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

type Wrapper = Awaited<ReturnType<typeof setup>>

function purgeButton(wrapper: Wrapper) {
  return wrapper.findAll('button').find(b => ['Purge page cache', 'Purging…'].includes(b.text()))
}

async function clickPurge(wrapper: Wrapper) {
  await purgeButton(wrapper)!.trigger('click')
  await flushPromises()
}

describe('Site settings page cache purge', () => {
  beforeEach(() => {
    mockOptions.pageCache = undefined
    mockReveal.mockResolvedValue({ isCanceled: false })
    mockPurgePageCache.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    mockReveal.mockReset()
    mockPurgePageCache.mockReset()
  })

  test('shows the page cache section when page caching is on by default', async () => {
    const wrapper = await setup()
    expect(wrapper.text()).toContain('Page cache')
    expect(purgeButton(wrapper)).toBeDefined()
  })

  test('hides the page cache section when page caching is disabled', async () => {
    mockOptions.pageCache = { enabled: false }
    const wrapper = await setup()
    expect(wrapper.text()).not.toContain('Page cache')
    expect(purgeButton(wrapper)).toBeUndefined()
  })

  test('confirms before purging with the approved wording', async () => {
    const wrapper = await setup()
    await clickPurge(wrapper)
    expect(mockReveal).toHaveBeenCalledWith({
      title: 'Purge the page cache?',
      content: '<p>Every cached page will be dropped at once and rebuilt on its next visit, so the site may be slower for a short while. No content will be lost.</p>',
    })
  })

  test('does not purge when the confirmation is cancelled', async () => {
    mockReveal.mockResolvedValue({ isCanceled: true })
    const wrapper = await setup()
    await clickPurge(wrapper)
    expect(mockPurgePageCache).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('The page cache has been purged')
    expect(wrapper.text()).not.toContain('The page cache could not be purged')
  })

  test('shows the purging label while the purge is in flight', async () => {
    let resolvePurge!: () => void
    mockPurgePageCache.mockReturnValue(new Promise<void>((resolve) => {
      resolvePurge = resolve
    }))
    const wrapper = await setup()
    await clickPurge(wrapper)
    expect(purgeButton(wrapper)!.text()).toBe('Purging…')
    expect(purgeButton(wrapper)!.attributes('disabled')).toBeDefined()
    resolvePurge()
    await flushPromises()
    expect(purgeButton(wrapper)!.text()).toBe('Purge page cache')
  })

  test('purges after confirmation and reports success', async () => {
    const wrapper = await setup()
    await clickPurge(wrapper)
    expect(mockPurgePageCache).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('The page cache has been purged. Pages will be rebuilt as they are next visited.')
  })

  test('explains a purge refused for lack of permission', async () => {
    mockPurgePageCache.mockRejectedValue(Object.assign(new Error('Forbidden'), { statusCode: 403 }))
    const wrapper = await setup()
    await clickPurge(wrapper)
    expect(wrapper.text()).toContain('The page cache could not be purged: your account does not have permission to do this.')
    expect(wrapper.text()).not.toContain('The page cache has been purged')
  })

  test('explains any other failed purge with its status code', async () => {
    mockPurgePageCache.mockRejectedValue(Object.assign(new Error('Server Error'), { statusCode: 500 }))
    const wrapper = await setup()
    await clickPurge(wrapper)
    expect(wrapper.text()).toContain('The page cache could not be purged (500). Please try again.')
  })

  test('explains a failed purge with no response as a network error', async () => {
    mockPurgePageCache.mockRejectedValue(new TypeError('Failed to fetch'))
    const wrapper = await setup()
    await clickPurge(wrapper)
    expect(wrapper.text()).toContain('The page cache could not be purged (network error). Please try again.')
  })
})

function warmButton(wrapper: Wrapper) {
  return wrapper.findAll('button').find(b => b.text() === 'Warm page cache' || b.text().startsWith('Warming…'))
}

async function clickWarm(wrapper: Wrapper) {
  await warmButton(wrapper)!.trigger('click')
  await flushPromises()
}

describe('Site settings page cache warm', () => {
  beforeEach(() => {
    mockOptions.pageCache = undefined
    mockReveal.mockResolvedValue({ isCanceled: false })
    mockWarmPageCache.mockResolvedValue({ total: 36, warmed: 36, failed: [] })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    mockReveal.mockReset()
    mockWarmPageCache.mockReset()
  })

  test('offers warming beside purge when page caching is on', async () => {
    const wrapper = await setup()
    expect(warmButton(wrapper)!.text()).toBe('Warm page cache')
    expect(purgeButton(wrapper)).toBeDefined()
  })

  test('does not offer warming when page caching is disabled', async () => {
    mockOptions.pageCache = { enabled: false }
    const wrapper = await setup()
    expect(warmButton(wrapper)).toBeUndefined()
  })

  test('explains warming in the page cache section, leaving the purge explanation as it was', async () => {
    const wrapper = await setup()
    expect(wrapper.text()).toContain('Warming loads every public page into the cache ahead of visitors, for example after a purge.')
    expect(wrapper.text()).toContain('Visitors are served a cached copy of each page. Purging drops every cached page at once, and each one is rebuilt the next time it is visited. No content is lost. You do not need to do this after ordinary edits, because those refresh the cache automatically.')
  })

  test('confirms before warming with the approved wording', async () => {
    const wrapper = await setup()
    await clickWarm(wrapper)
    expect(mockReveal).toHaveBeenCalledWith({
      title: 'Warm the page cache?',
      content: '<p>Every public page will be loaded and stored in the page cache, so visitors get fast responses straight away. Pages are loaded a few at a time, which can take a few minutes on a large site. Keep this page open until it finishes.</p>',
    })
  })

  test('does not warm when the confirmation is cancelled', async () => {
    mockReveal.mockResolvedValue({ isCanceled: true })
    const wrapper = await setup()
    await clickWarm(wrapper)
    expect(mockWarmPageCache).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('The page cache has been warmed')
  })

  test('counts progress up on the button while warming', async () => {
    let onProgress!: (progress: { completed: number, total: number }) => void
    let finish!: () => void
    mockWarmPageCache.mockImplementation((callback) => {
      onProgress = callback
      return new Promise((resolve) => {
        finish = () => resolve({ total: 36, warmed: 36, failed: [] })
      })
    })
    const wrapper = await setup()
    await clickWarm(wrapper)
    expect(warmButton(wrapper)!.text()).toBe('Warming…')
    expect(warmButton(wrapper)!.attributes('disabled')).toBeDefined()

    onProgress({ completed: 0, total: 36 })
    await flushPromises()
    expect(warmButton(wrapper)!.text()).toBe('Warming… 0 of 36')

    onProgress({ completed: 12, total: 36 })
    await flushPromises()
    expect(warmButton(wrapper)!.text()).toBe('Warming… 12 of 36')

    finish()
    await flushPromises()
    expect(warmButton(wrapper)!.text()).toBe('Warm page cache')
    expect(warmButton(wrapper)!.attributes('disabled')).toBeUndefined()
  })

  test('reports a warm where every page loaded', async () => {
    const wrapper = await setup()
    await clickWarm(wrapper)
    expect(mockWarmPageCache).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('The page cache has been warmed. All 36 pages were loaded.')
  })

  test('lists the pages that could not be warmed', async () => {
    mockWarmPageCache.mockResolvedValue({
      total: 36,
      warmed: 34,
      failed: [{ path: '/a', status: 404 }, { path: '/b', status: 0, error: 'timeout' }],
    })
    const wrapper = await setup()
    await clickWarm(wrapper)
    expect(wrapper.text()).toContain('36 pages were checked, but 2 could not be warmed: /a (404), /b (timed out).')
    expect(wrapper.text()).not.toContain('The page cache has been warmed')
  })

  test('describes a page with no response', async () => {
    mockWarmPageCache.mockResolvedValue({ total: 2, warmed: 1, failed: [{ path: '/c', status: 0, error: 'network' }] })
    const wrapper = await setup()
    await clickWarm(wrapper)
    expect(wrapper.text()).toContain('2 pages were checked, but 1 could not be warmed: /c (no response).')
  })

  test('names the cause when a page could not be reached at all', async () => {
    mockWarmPageCache.mockResolvedValue({ total: 2, warmed: 1, failed: [{ path: '/c', status: 0, error: 'network', detail: 'DEPTH_ZERO_SELF_SIGNED_CERT' }] })
    const wrapper = await setup()
    await clickWarm(wrapper)
    expect(wrapper.text()).toContain('2 pages were checked, but 1 could not be warmed: /c (no response: DEPTH_ZERO_SELF_SIGNED_CERT).')
  })

  test('names where a redirected page was sent instead of being rendered', async () => {
    mockWarmPageCache.mockResolvedValue({ total: 2, warmed: 1, failed: [{ path: '/about', status: 308, location: 'https://www.example.com/about' }] })
    const wrapper = await setup()
    await clickWarm(wrapper)
    expect(wrapper.text()).toContain('2 pages were checked, but 1 could not be warmed: /about (308 → https://www.example.com/about).')
  })

  test('explains a warm refused for lack of permission', async () => {
    mockWarmPageCache.mockRejectedValue(Object.assign(new Error('Forbidden'), { statusCode: 403 }))
    const wrapper = await setup()
    await clickWarm(wrapper)
    expect(wrapper.text()).toContain('The page cache could not be warmed: your account does not have permission to do this.')
  })

  test('explains that a warm is already running', async () => {
    mockWarmPageCache.mockRejectedValue(Object.assign(new Error('Conflict'), { statusCode: 409 }))
    const wrapper = await setup()
    await clickWarm(wrapper)
    expect(wrapper.text()).toContain('The page cache is already being warmed on this server. Please wait for it to finish.')
  })

  test('explains a warm that stopped part way through', async () => {
    mockWarmPageCache.mockRejectedValue(new PageCacheWarmInterruptedError({ completed: 12, total: 36 }))
    const wrapper = await setup()
    await clickWarm(wrapper)
    expect(wrapper.text()).toContain('Warming stopped before it finished (12 of 36 pages). Please try again.')
  })

  test('explains any other failed warm with its status code', async () => {
    mockWarmPageCache.mockRejectedValue(Object.assign(new Error('Server Error'), { statusCode: 500 }))
    const wrapper = await setup()
    await clickWarm(wrapper)
    expect(wrapper.text()).toContain('The page cache could not be warmed (500). Please try again.')
  })

  test('explains a failed warm with no response as a network error', async () => {
    mockWarmPageCache.mockRejectedValue(new TypeError('Failed to fetch'))
    const wrapper = await setup()
    await clickWarm(wrapper)
    expect(wrapper.text()).toContain('The page cache could not be warmed (network error). Please try again.')
  })
})

function purgeAllButton(wrapper: Wrapper) {
  return wrapper.findAll('button').find(b => ['Purge all cached data', 'Purging all cached data…'].includes(b.text()))
}

function warmNowButton(wrapper: Wrapper) {
  return wrapper.findAll('button').find(b => b.text() === 'Warm page cache now')
}

async function clickPurgeAll(wrapper: Wrapper) {
  await purgeAllButton(wrapper)!.trigger('click')
  await flushPromises()
}

describe('Site settings full cache purge', () => {
  beforeEach(() => {
    mockOptions.pageCache = undefined
    mockReveal.mockResolvedValue({ isCanceled: false })
    mockPurgeHttpCache.mockResolvedValue(undefined)
    mockWarmPageCache.mockResolvedValue({ total: 36, warmed: 36, failed: [] })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    mockReveal.mockReset()
    mockPurgeHttpCache.mockReset()
    mockWarmPageCache.mockReset()
  })

  test('offers purging everything beside the page cache actions when page caching is on', async () => {
    const wrapper = await setup()
    expect(purgeAllButton(wrapper)!.text()).toBe('Purge all cached data')
    expect(purgeButton(wrapper)).toBeDefined()
    expect(warmButton(wrapper)).toBeDefined()
  })

  test('offers purging everything when page caching is off, with no page cache actions', async () => {
    mockOptions.pageCache = { enabled: false }
    const wrapper = await setup()
    expect(purgeAllButton(wrapper)!.text()).toBe('Purge all cached data')
    expect(wrapper.text()).toContain('Pages are rendered fresh on every visit in this configuration, so this purges the API cache only.')
    expect(purgeButton(wrapper)).toBeUndefined()
    expect(warmButton(wrapper)).toBeUndefined()
  })

  test('confirms before purging everything with the approved wording', async () => {
    const wrapper = await setup()
    await clickPurgeAll(wrapper)
    expect(mockReveal).toHaveBeenCalledWith({
      title: 'Purge all cached data?',
      content: '<p>Everything the API has cached will be dropped at once, along with every cached page. Use this after data has been changed outside the admin — ordinary edits are purged for you. Pages will be slow until they have been rendered again, and no content will be lost.</p>',
    })
  })

  test('does not purge anything when the confirmation is cancelled', async () => {
    mockReveal.mockResolvedValue({ isCanceled: true })
    const wrapper = await setup()
    await clickPurgeAll(wrapper)
    expect(mockPurgeHttpCache).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('All cached data has been purged')
    expect(wrapper.text()).not.toContain('Nothing was purged')
    expect(wrapper.text()).not.toContain('The cache could not be purged')
  })

  test('shows the purging label while the full purge is in flight', async () => {
    let resolvePurge!: () => void
    mockPurgeHttpCache.mockReturnValue(new Promise<void>((resolve) => {
      resolvePurge = resolve
    }))
    const wrapper = await setup()
    await clickPurgeAll(wrapper)
    expect(purgeAllButton(wrapper)!.text()).toBe('Purging all cached data…')
    expect(purgeAllButton(wrapper)!.attributes('disabled')).toBeDefined()
    resolvePurge()
    await flushPromises()
    expect(purgeAllButton(wrapper)!.text()).toBe('Purge all cached data')
  })

  test('purges after confirmation and reports success', async () => {
    const wrapper = await setup()
    await clickPurgeAll(wrapper)
    expect(mockPurgeHttpCache).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('All cached data has been purged. Pages will be slow until they have been rendered again.')
  })

  test('reports a deployment that cannot flush its cache as nothing purged, never as success', async () => {
    mockPurgeHttpCache.mockRejectedValue(Object.assign(new Error('Not Implemented'), { statusCode: 501 }))
    const wrapper = await setup()
    await clickPurgeAll(wrapper)
    expect(wrapper.text()).toContain('Nothing was purged. This deployment\'s cache cannot be flushed.')
    expect(wrapper.text()).not.toContain('All cached data has been purged')
    expect(warmNowButton(wrapper)).toBeUndefined()
  })

  test('explains a full purge refused for lack of permission', async () => {
    mockPurgeHttpCache.mockRejectedValue(Object.assign(new Error('Forbidden'), { statusCode: 403 }))
    const wrapper = await setup()
    await clickPurgeAll(wrapper)
    expect(wrapper.text()).toContain('The cache could not be purged: your account does not have permission to do this.')
    expect(wrapper.text()).not.toContain('All cached data has been purged')
  })

  test('explains any other failed full purge with its status code', async () => {
    mockPurgeHttpCache.mockRejectedValue(Object.assign(new Error('Server Error'), { statusCode: 500 }))
    const wrapper = await setup()
    await clickPurgeAll(wrapper)
    expect(wrapper.text()).toContain('The cache could not be purged (500). Please try again.')
  })

  test('explains a failed full purge with no response as a network error', async () => {
    mockPurgeHttpCache.mockRejectedValue(new TypeError('Failed to fetch'))
    const wrapper = await setup()
    await clickPurgeAll(wrapper)
    expect(wrapper.text()).toContain('The cache could not be purged (network error). Please try again.')
  })

  test('offers the warm after a successful full purge when page caching is on', async () => {
    const wrapper = await setup()
    expect(warmNowButton(wrapper)).toBeUndefined()
    await clickPurgeAll(wrapper)
    expect(warmNowButton(wrapper)).toBeDefined()
    await warmNowButton(wrapper)!.trigger('click')
    await flushPromises()
    expect(mockWarmPageCache).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('The page cache has been warmed. All 36 pages were loaded.')
  })

  test('does not offer the warm after a successful full purge when page caching is off', async () => {
    mockOptions.pageCache = { enabled: false }
    const wrapper = await setup()
    await clickPurgeAll(wrapper)
    expect(wrapper.text()).toContain('All cached data has been purged')
    expect(warmNowButton(wrapper)).toBeUndefined()
  })
})

function orphanReport(overrides: Record<string, any> = {}) {
  return {
    generatedAt: '2026-09-25T10:00:00+00:00',
    components: ['/component/html_contents/c1', '/component/images/c2'],
    componentPositions: ['/_/component_positions/p1'],
    componentGroups: [],
    ...overrides,
  }
}

function fileReport(overrides: Record<string, any> = {}) {
  return {
    generatedAt: '2026-09-24T09:00:00.123456+00:00',
    orphanedFiles: [{ adapter: 'local', path: 'files/a.png' }, { adapter: 's3', path: 'files/b.png' }],
    missingFiles: [{ resource: '/component/images/i1', adapter: 'local', path: 'files/gone.png' }],
    ...overrides,
  }
}

function orphanStatusError(statusCode: number) {
  return Object.assign(new Error('failed'), { statusCode })
}

describe('Site settings orphaned resources', () => {
  beforeEach(() => {
    mockOptions.pageCache = undefined
    mockFetchOrphanReport.mockReset().mockResolvedValue(orphanReport())
    mockRequestOrphanScan.mockReset().mockResolvedValue(undefined)
    mockFetchFileReport.mockReset().mockResolvedValue(fileReport({ orphanedFiles: [], missingFiles: [] }))
    mockRequestFileScan.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function notice(wrapper: Wrapper) {
    return wrapper.find('[data-testid="orphaned-notice"]')
  }

  function section(wrapper: Wrapper) {
    return wrapper.find('[data-testid="orphaned-settings"]')
  }

  function scanNowButton(wrapper: Wrapper) {
    return section(wrapper).findAll('button').find(b => ['Scan now', 'Scanning…'].includes(b.text()))
  }

  test('links to the orphaned resources page', async () => {
    const wrapper = await setup()
    const link = section(wrapper).findAll('a').find(a => a.text() === 'Review orphaned resources')
    expect(link?.attributes('data-route-name')).toBe('_cwa-orphaned')
  })

  test('a report listing orphans shows a notice with its count and a review link', async () => {
    const wrapper = await setup()
    expect(notice(wrapper).text()).toContain('Orphaned resources discovered')
    expect(notice(wrapper).text()).toContain('3')
    const cta = notice(wrapper).findAll('a').find(a => a.text() === 'Review now')
    expect(cta?.attributes('data-route-name')).toBe('_cwa-orphaned')
  })

  test('an empty report shows no notice', async () => {
    mockFetchOrphanReport.mockResolvedValue(orphanReport({ components: [], componentPositions: [] }))
    const wrapper = await setup()
    expect(notice(wrapper).exists()).toBe(false)
  })

  test('no stored report shows no notice and says it has never been scanned', async () => {
    mockFetchOrphanReport.mockRejectedValue(orphanStatusError(404))
    const wrapper = await setup()
    expect(notice(wrapper).exists()).toBe(false)
    expect(section(wrapper).text()).toContain('Never scanned')
  })

  test('a failed report request shows no notice and no error, and does not scan', async () => {
    mockFetchOrphanReport.mockRejectedValue(orphanStatusError(500))
    const wrapper = await setup()
    expect(notice(wrapper).exists()).toBe(false)
    expect(wrapper.text()).not.toContain('could not be loaded')
    expect(section(wrapper).text()).not.toContain('Never scanned')
    expect(mockRequestOrphanScan).not.toHaveBeenCalled()
  })

  test('shows when the last scan ran', async () => {
    const wrapper = await setup()
    expect(section(wrapper).text()).toContain('Last scanned 25 Sep 2026')
  })

  test('scan now requests a scan and refreshes from the new report', async () => {
    mockFetchOrphanReport.mockRejectedValueOnce(orphanStatusError(404))
    const wrapper = await setup()
    expect(notice(wrapper).exists()).toBe(false)
    await scanNowButton(wrapper)!.trigger('click')
    await flushPromises()
    expect(mockRequestOrphanScan).toHaveBeenCalledTimes(1)
    expect(mockFetchOrphanReport).toHaveBeenCalledTimes(2)
    expect(section(wrapper).text()).toContain('Last scanned 25 Sep 2026')
    expect(notice(wrapper).text()).toContain('Orphaned resources discovered')
  })

  test('a scan that has not finished within the polling bound says it was requested', async () => {
    vi.useFakeTimers()
    const wrapper = await setup()
    await scanNowButton(wrapper)!.trigger('click')
    await vi.advanceTimersByTimeAsync(60_000)
    await flushPromises()
    expect(section(wrapper).text()).toContain('The scan has been requested but has not finished yet.')
  })

  test('a failed scan shows its error in the orphaned resources section', async () => {
    mockRequestOrphanScan.mockRejectedValue(orphanStatusError(403))
    const wrapper = await setup()
    await scanNowButton(wrapper)!.trigger('click')
    await flushPromises()
    expect(section(wrapper).text()).toContain('The scan could not be requested (403). Please try again.')
    expect(notice(wrapper).text()).toContain('Orphaned resources discovered')
  })

  describe('files', () => {
    function scanFilesButton(wrapper: Wrapper) {
      return section(wrapper).findAll('button').find(b => ['Scan files', 'Scanning…'].includes(b.text()))
    }

    test('the notice counts orphaned resources, orphaned files and missing files together', async () => {
      mockFetchFileReport.mockResolvedValue(fileReport())
      const wrapper = await setup()
      expect(notice(wrapper).text()).toContain('Orphaned resources discovered: 3 resources and 2 files are no longer used anywhere on the site. 1 file is missing from storage.')
    })

    test('orphaned files alone show the notice', async () => {
      mockFetchOrphanReport.mockResolvedValue(orphanReport({ components: [], componentPositions: [] }))
      mockFetchFileReport.mockResolvedValue(fileReport({ orphanedFiles: [{ adapter: 'local', path: 'files/a.png' }], missingFiles: [] }))
      const wrapper = await setup()
      expect(notice(wrapper).text()).toContain('Orphaned resources discovered: 1 file is no longer used anywhere on the site.')
      expect(notice(wrapper).text()).not.toContain('missing')
    })

    test('missing files alone show the notice', async () => {
      mockFetchOrphanReport.mockResolvedValue(orphanReport({ components: [], componentPositions: [] }))
      mockFetchFileReport.mockResolvedValue(fileReport({ orphanedFiles: [], missingFiles: [
        { resource: '/component/images/i1', adapter: 'local', path: 'files/gone.png' },
        { resource: '/component/images/i2', adapter: 'local', path: 'files/gone-too.png' },
      ] }))
      const wrapper = await setup()
      expect(notice(wrapper).text()).toContain('Orphaned resources discovered: 2 files are missing from storage.')
      expect(notice(wrapper).findAll('a').find(a => a.text() === 'Review now')?.attributes('data-route-name')).toBe('_cwa-orphaned')
    })

    test('a failed file report shows no error and leaves the resource count in the notice', async () => {
      mockFetchFileReport.mockRejectedValue(orphanStatusError(500))
      const wrapper = await setup()
      expect(notice(wrapper).text()).toContain('Orphaned resources discovered: 3 resources are no longer used anywhere on the site.')
      expect(wrapper.text()).not.toContain('could not be loaded')
      expect(section(wrapper).text()).not.toContain('Files: Never scanned')
      expect(mockRequestFileScan).not.toHaveBeenCalled()
    })

    test('failures of both reports show no notice at all', async () => {
      mockFetchOrphanReport.mockRejectedValue(orphanStatusError(500))
      mockFetchFileReport.mockRejectedValue(orphanStatusError(502))
      const wrapper = await setup()
      expect(notice(wrapper).exists()).toBe(false)
    })

    test('shows when files were last scanned, or that they never have been', async () => {
      mockFetchFileReport.mockResolvedValue(fileReport())
      const wrapper = await setup()
      expect(section(wrapper).text()).toContain('Components: Last scanned 25 Sep 2026')
      expect(section(wrapper).text()).toContain('Files: Last scanned 24 Sep 2026')
      mockFetchFileReport.mockRejectedValue(orphanStatusError(404))
      const unscanned = await setup()
      expect(section(unscanned).text()).toContain('Files: Never scanned')
    })

    test('loading the page scans nothing', async () => {
      await setup()
      expect(mockRequestOrphanScan).not.toHaveBeenCalled()
      expect(mockRequestFileScan).not.toHaveBeenCalled()
    })

    test('scan files requests a file scan only and refreshes the notice from the new file report', async () => {
      mockFetchOrphanReport.mockResolvedValue(orphanReport({ components: [], componentPositions: [] }))
      const wrapper = await setup()
      expect(notice(wrapper).exists()).toBe(false)
      mockFetchFileReport.mockResolvedValue(fileReport({ generatedAt: '2026-09-26T09:00:00+00:00' }))
      await scanFilesButton(wrapper)!.trigger('click')
      await flushPromises()
      expect(mockRequestFileScan).toHaveBeenCalledTimes(1)
      expect(mockRequestOrphanScan).not.toHaveBeenCalled()
      expect(section(wrapper).text()).toContain('Files: Last scanned 26 Sep 2026')
      expect(notice(wrapper).text()).toContain('2 files')
    })

    test('scan now scans components only', async () => {
      const wrapper = await setup()
      await scanNowButton(wrapper)!.trigger('click')
      await flushPromises()
      expect(mockRequestFileScan).not.toHaveBeenCalled()
    })

    test('a failed file scan shows its error in the section', async () => {
      mockRequestFileScan.mockRejectedValue(orphanStatusError(403))
      const wrapper = await setup()
      await scanFilesButton(wrapper)!.trigger('click')
      await flushPromises()
      expect(section(wrapper).text()).toContain('The scan could not be requested (403). Please try again.')
    })
  })
})
