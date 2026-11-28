// @vitest-environment nuxt
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, routerKey } from 'vue-router'
import { axe } from '../../../../../test/utils/axe'
import { drawsFocusRing } from '../../../../../test/utils/focus-ring'
import SettingsPage from './settings.vue'
import * as cwaComposable from '#cwa/composables/cwa'
import { useRouter } from '#app/composables/router'
import { PageCacheWarmInterruptedError } from '#cwa/api/page-cache-warm'

const { mockOptions, mockConfirm, mockPurgePageCache, mockPurgeHttpCache, mockWarmPageCache, mockFetchOrphanReport, mockRequestOrphanScan, mockFetchFileReport, mockRequestFileScan, mockSaveConfig } = vi.hoisted(() => ({
  mockOptions: { pageCache: undefined as undefined | { enabled?: boolean } },
  mockConfirm: vi.fn(),
  mockPurgePageCache: vi.fn(),
  mockPurgeHttpCache: vi.fn(),
  mockWarmPageCache: vi.fn(),
  mockFetchOrphanReport: vi.fn(),
  mockRequestOrphanScan: vi.fn(),
  mockFetchFileReport: vi.fn(),
  mockRequestFileScan: vi.fn(),
  mockSaveConfig: vi.fn(),
}))

vi.mock('#build/cwa-options', () => ({
  options: mockOptions,
  currentModulePackageInfo: { version: '2.0.0-alpha.32', name: '@cwa/nuxt' },
}))

enableAutoUnmount(afterEach)

vi.mock('#cwa/composables/cwa-confirm', () => ({ useCwaConfirm: () => mockConfirm }))

const storedConfig = ref<Record<string, any>>({})

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

let currentRouter: ReturnType<typeof createRouter>

async function setup(opts: { loadFails?: boolean, heading?: boolean, apiDocsVersion?: string, appPackage?: { version: string, name: string }, hash?: string } = {}) {
  storedConfig.value = { ...config }
  const loadConfig = opts.loadFails ? vi.fn().mockRejectedValueOnce(new Error('offline')).mockImplementation(async () => ({ ...storedConfig.value })) : vi.fn(async () => ({ ...storedConfig.value }))
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    siteConfig: {
      get config() { return storedConfig.value },
      loadConfig,
      saveConfig: mockSaveConfig,
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
    getApiDocumentation: vi.fn().mockResolvedValue(opts.apiDocsVersion === undefined ? undefined : { docs: { info: { version: opts.apiDocsVersion } } }),
    currentModulePackageInfo: opts.appPackage ?? { version: '2.0.0-alpha.32', name: '@cwa/nuxt' },
  }) as unknown as ReturnType<typeof cwaComposable.useCwa>)

  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:any(.*)', component: { render: () => null } }] })
  currentRouter = router
  await router.push(`/_cwa/settings${opts.hash ?? ''}`)
  const wrapper = mount(SettingsPage, {
    attachTo: document.body,
    global: {
      provide: { [routerKey as symbol]: router },
      stubs: {
        ...(opts.heading ? {} : { ListHeading: true }),
        RouterLink: { props: ['to'], template: '<a :data-route-name="to?.name"><slot /></a>' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

type Wrapper = Awaited<ReturnType<typeof setup>>

function purgeButton(wrapper: Wrapper) {
  const button = wrapper.find('[data-testid="purge-page-cache"]')
  return button.exists() ? button : undefined
}

async function clickPurge(wrapper: Wrapper) {
  await purgeButton(wrapper)!.trigger('click')
  await flushPromises()
}

describe('Site settings page cache purge', () => {
  beforeEach(() => {
    mockOptions.pageCache = undefined
    mockConfirm.mockResolvedValue(true)
    mockPurgePageCache.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    mockConfirm.mockReset()
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
    expect(mockConfirm).toHaveBeenCalledWith({
      title: 'Purge the page cache?',
      description: 'Every cached page will be dropped at once and rebuilt on its next visit, so the site may be slower for a short while. No content will be lost.',
      keep: 'Don\'t purge',
      go: 'Purge page cache',
    })
  })

  test('does not purge when the confirmation is cancelled', async () => {
    mockConfirm.mockResolvedValue(false)
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
    expect(purgeButton(wrapper)!.attributes('aria-busy')).toBe('true')
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
  const button = wrapper.find('[data-testid="warm-page-cache"]')
  return button.exists() ? button : undefined
}

async function clickWarm(wrapper: Wrapper) {
  await warmButton(wrapper)!.trigger('click')
  await flushPromises()
}

describe('Site settings page cache warm', () => {
  beforeEach(() => {
    mockOptions.pageCache = undefined
    mockConfirm.mockResolvedValue(true)
    mockWarmPageCache.mockResolvedValue({ total: 36, warmed: 36, failed: [] })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    mockConfirm.mockReset()
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
    expect(mockConfirm).toHaveBeenCalledWith({
      title: 'Warm the page cache?',
      description: 'Every public page will be loaded and stored in the page cache, so visitors get fast responses straight away. Pages are loaded a few at a time, which can take a few minutes on a large site. Keep this page open until it finishes.',
      keep: 'Don\'t warm',
      go: 'Warm page cache',
      tone: 'accent',
    })
  })

  test('does not warm when the confirmation is cancelled', async () => {
    mockConfirm.mockResolvedValue(false)
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
    expect(warmButton(wrapper)!.attributes('aria-busy')).toBe('true')

    onProgress({ completed: 0, total: 36 })
    await flushPromises()
    expect(warmButton(wrapper)!.text()).toBe('Warming… 0 of 36')

    onProgress({ completed: 12, total: 36 })
    await flushPromises()
    expect(warmButton(wrapper)!.text()).toBe('Warming… 12 of 36')

    finish()
    await flushPromises()
    expect(warmButton(wrapper)!.text()).toBe('Warm page cache')
    expect(warmButton(wrapper)!.attributes('aria-busy')).toBeUndefined()
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
  const button = wrapper.find('[data-testid="purge-http-cache"]')
  return button.exists() ? button : undefined
}

function warmNowButton(wrapper: Wrapper) {
  const button = wrapper.find('[data-testid="warm-page-cache-now"]')
  return button.exists() ? button : undefined
}

async function clickPurgeAll(wrapper: Wrapper) {
  await purgeAllButton(wrapper)!.trigger('click')
  await flushPromises()
}

describe('Site settings full cache purge', () => {
  beforeEach(() => {
    mockOptions.pageCache = undefined
    mockConfirm.mockResolvedValue(true)
    mockPurgeHttpCache.mockResolvedValue(undefined)
    mockWarmPageCache.mockResolvedValue({ total: 36, warmed: 36, failed: [] })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    mockConfirm.mockReset()
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
    expect(mockConfirm).toHaveBeenCalledWith({
      title: 'Purge all cached data?',
      lines: [
        { text: 'Everything the API has cached will be dropped at once, along with every cached page, and every page will be slow until it has been rendered again.', emphasis: 'strong' },
        { text: 'To refresh one page, use Purge this page\'s cache in that page\'s settings instead. Ordinary edits are purged for you, and no content will be lost.', emphasis: 'muted' },
      ],
      keep: 'Don\'t purge',
      go: 'Purge all cached data',
    })
  })

  test('#484 presents purging everything as a last resort and points to purging one page', async () => {
    const wrapper = await setup()
    expect(wrapper.text()).toContain('Purging all cached data is a last resort: every page is slow until it has been rendered again. After data has been changed outside the admin, purge the pages it affects from each page\'s settings instead.')
  })

  test('does not purge anything when the confirmation is cancelled', async () => {
    mockConfirm.mockResolvedValue(false)
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
    expect(purgeAllButton(wrapper)!.attributes('aria-busy')).toBe('true')
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
    return section(wrapper).find('[data-testid="scan-orphans"]')
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
      return section(wrapper).find('[data-testid="scan-files"]')
    }

    test('the notice counts orphaned resources, orphaned files and missing files together', async () => {
      mockFetchFileReport.mockResolvedValue(fileReport())
      const wrapper = await setup()
      expect(notice(wrapper).text()).toContain('3 resources and 2 files are no longer used anywhere on the site. 1 file is missing from storage.')
    })

    test('orphaned files alone show the notice', async () => {
      mockFetchOrphanReport.mockResolvedValue(orphanReport({ components: [], componentPositions: [] }))
      mockFetchFileReport.mockResolvedValue(fileReport({ orphanedFiles: [{ adapter: 'local', path: 'files/a.png' }], missingFiles: [] }))
      const wrapper = await setup()
      expect(notice(wrapper).text()).toContain('1 file is no longer used anywhere on the site.')
      expect(notice(wrapper).text()).not.toContain('missing')
    })

    test('missing files alone show the notice', async () => {
      mockFetchOrphanReport.mockResolvedValue(orphanReport({ components: [], componentPositions: [] }))
      mockFetchFileReport.mockResolvedValue(fileReport({ orphanedFiles: [], missingFiles: [
        { resource: '/component/images/i1', adapter: 'local', path: 'files/gone.png' },
        { resource: '/component/images/i2', adapter: 'local', path: 'files/gone-too.png' },
      ] }))
      const wrapper = await setup()
      expect(notice(wrapper).text()).toContain('2 files are missing from storage.')
      expect(notice(wrapper).findAll('a').find(a => a.text() === 'Review now')?.attributes('data-route-name')).toBe('_cwa-orphaned')
    })

    test('the notice says how many files no longer meet their upload rules, after the missing files', async () => {
      const invalid = { resource: '/component/images/i2', field: 'file', adapter: 'local', path: 'files/huge.png', violations: ['Too large.'] }
      mockFetchFileReport.mockResolvedValue(fileReport({ invalidFiles: [invalid, { ...invalid, resource: '/component/images/i3' }] }))
      const wrapper = await setup()
      expect(notice(wrapper).text()).toContain('3 resources and 2 files are no longer used anywhere on the site. 1 file is missing from storage. 2 files no longer meet their upload rules.')
    })

    test('one invalid file alone shows the notice in the singular', async () => {
      const invalid = { resource: '/component/images/i2', field: 'file', adapter: 'local', path: 'files/huge.png', violations: ['Too large.'] }
      mockFetchOrphanReport.mockResolvedValue(orphanReport({ components: [], componentPositions: [] }))
      mockFetchFileReport.mockResolvedValue(fileReport({ orphanedFiles: [], missingFiles: [], invalidFiles: [invalid] }))
      const wrapper = await setup()
      expect(notice(wrapper).text()).toContain('1 file no longer meets its upload rules.')
    })

    test('no invalid files leaves the upload rules out of the notice', async () => {
      mockFetchFileReport.mockResolvedValue(fileReport({ invalidFiles: [] }))
      const wrapper = await setup()
      expect(notice(wrapper).text()).toContain('1 file is missing from storage.')
      expect(notice(wrapper).text()).not.toContain('upload rules')
    })

    test('a failed file report shows no error and leaves the resource count in the notice', async () => {
      mockFetchFileReport.mockRejectedValue(orphanStatusError(500))
      const wrapper = await setup()
      expect(notice(wrapper).text()).toContain('3 resources are no longer used anywhere on the site.')
      expect(wrapper.text()).not.toContain('could not be loaded')
      expect(section(wrapper).text()).not.toContain('Files Never scanned')
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
      expect(section(wrapper).text()).toContain('Components Last scanned 25 Sep 2026')
      expect(section(wrapper).text()).toContain('Files Last scanned 24 Sep 2026')
      mockFetchFileReport.mockRejectedValue(orphanStatusError(404))
      const unscanned = await setup()
      expect(section(unscanned).text()).toContain('Files Never scanned')
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
      expect(section(wrapper).text()).toContain('Files Last scanned 26 Sep 2026')
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

describe('Site settings form on the kit (#461)', () => {
  beforeEach(() => {
    mockOptions.pageCache = undefined
    mockConfirm.mockResolvedValue(true)
    mockFetchOrphanReport.mockReset().mockResolvedValue(orphanReport())
    mockFetchFileReport.mockReset().mockResolvedValue(fileReport())
    mockSaveConfig.mockReset().mockImplementation(async (changed: Record<string, any>) => {
      storedConfig.value = { ...storedConfig.value, ...changed }
      return []
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const save = (wrapper: Wrapper) => wrapper.get('[data-testid="form-group-save"]')
  const saveLabel = (wrapper: Wrapper) => save(wrapper).findAll('span').filter(span => !span.classes().includes('cwa:sr-only')).map(span => span.text()).join('')

  async function type(wrapper: Wrapper, field: string, value: string) {
    await wrapper.get(`[data-cwa-field="${field}"] :is(input, textarea)`).setValue(value)
    await flushPromises()
  }

  test('edits a local copy and Save sends only the changed settings, with the one count on Save', async () => {
    const wrapper = await setup()

    await type(wrapper, 'siteName', 'Kitchens')
    await wrapper.get('[data-cwa-field="maintenanceModeEnabled"] [role="switch"]').trigger('click')
    await flushPromises()

    expect(storedConfig.value.siteName).toBe('Site')
    expect(saveLabel(wrapper)).toBe('Save 2 changes')
    expect(wrapper.text()).not.toMatch(/\d+ unsaved/)
    await save(wrapper).trigger('click')
    await flushPromises()

    expect(mockSaveConfig).toHaveBeenCalledTimes(1)
    expect(mockSaveConfig).toHaveBeenCalledWith({ siteName: 'Kitchens', maintenanceModeEnabled: true })
    expect(saveLabel(wrapper)).toBe('Saved')
  })

  test('a setting the API refuses shows its message on the field and in the alert', async () => {
    const refused = Object.assign(new Error('422'), { statusCode: 422, data: { violations: [{ propertyPath: 'value', message: 'This value is not a valid URL.' }] } })
    mockSaveConfig.mockImplementation(async (changed: Record<string, any>) => Object.keys(changed).map(key => ({ key, error: refused })))
    const wrapper = await setup()

    await type(wrapper, 'canonicalUrl', 'https://kitchens.example')
    await save(wrapper).trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-cwa-field="canonicalUrl"] [data-testid="field-error"]').text()).toBe('This value is not a valid URL.')
    expect(wrapper.get('[data-testid="form-group-alert"]').text()).toContain('Canonical URL')
    expect(saveLabel(wrapper)).toBe('Save 1 change')
  })

  test('the AI and non-SEO crawler toggles show only while the site can be indexed', async () => {
    const wrapper = await setup({ hash: '#seo' })
    expect(wrapper.get('[data-cwa-field="robotsAllowAiBots"]').isVisible()).toBe(true)

    await wrapper.get('[data-cwa-field="indexable"] [role="switch"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-cwa-field="robotsAllowAiBots"]').isVisible()).toBe(false)
    expect(wrapper.get('[data-cwa-field="robotsAllowNonSeoCrawlers"]').isVisible()).toBe(false)
  })

  test('the canonical URL\'s fixed explanation is behind its ⓘ, never a line under the field', async () => {
    const wrapper = await setup()

    const text = 'Your primary domain, with no redirects.'
    const element = wrapper.get('[data-cwa-field="canonicalUrl"]')
    expect(element.find('[data-testid="field-info"]').exists()).toBe(true)
    expect(element.findAll('p').map(line => line.text())).not.toContain(text)
    expect(element.get('input').attributes('aria-describedby')!.split(' ').map(id => document.getElementById(id)?.textContent?.trim())).toContain(text)
  })

  test('the title helpers follow their toggles, as a line under each', async () => {
    const wrapper = await setup()
    expect(wrapper.get('[data-cwa-field="concatTitle"]').findAll('p').map(line => line.text())).toContain('Page titles are formatted as “Page title | Site name”.')

    await wrapper.get('[data-cwa-field="concatTitle"] [role="switch"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-cwa-field="concatTitle"]').findAll('p').map(line => line.text())).toContain('Page titles are formatted as “Page title”.')
  })

  test('the maintenance line shows only while maintenance mode is on', async () => {
    const wrapper = await setup()
    const text = 'Visitors are sent to a “website under maintenance” page, and crawlers get a status code saying it is temporary.'
    expect(wrapper.get('[data-cwa-field="maintenanceModeEnabled"]').text()).not.toContain(text)

    await wrapper.get('[data-cwa-field="maintenanceModeEnabled"] [role="switch"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-cwa-field="maintenanceModeEnabled"]').findAll('p').map(line => line.text())).toContain(text)
  })

  test('a robots.txt that blocks every crawler warns, and still saves', async () => {
    const wrapper = await setup()

    await type(wrapper, 'robotsText', 'User-agent: *\nDisallow: /')

    expect(wrapper.get('[data-testid="robots-warning"]').text()).toContain('The user defined robots.txt is blocking indexing for all environments.')
    await save(wrapper).trigger('click')
    await flushPromises()
    expect(mockSaveConfig).toHaveBeenCalledWith({ robotsText: 'User-agent: *\nDisallow: /' })
  })

  test('a canonical URL other than the address in use warns', async () => {
    storedConfig.value = { ...config }
    const wrapper = await setup()
    expect(wrapper.find('[data-testid="canonical-mismatch"]').exists()).toBe(false)

    storedConfig.value = { ...storedConfig.value, canonicalUrl: 'https://elsewhere.example' }
    await flushPromises()

    expect(wrapper.get('[data-testid="canonical-mismatch"]').text()).toContain('This isn\'t the address you\'re using now.')
  })

  test('a failed load says so and Try again loads again', async () => {
    const wrapper = await setup({ loadFails: true })

    expect(wrapper.get('[data-testid="settings-load-error"]').text()).toContain('The settings couldn\'t be loaded.')
    expect(wrapper.find('[data-testid="form-group"]').exists()).toBe(false)
    await wrapper.get('[data-testid="settings-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="form-group"]').exists()).toBe(true)
  })

  test('purge and warm outcomes are announced through the page\'s one polite region', async () => {
    mockPurgePageCache.mockResolvedValue(undefined)
    const wrapper = await setup()

    await clickPurge(wrapper)

    expect(wrapper.get('[data-testid="form-group-announcer"]').text()).toBe('The page cache has been purged.')
    expect(wrapper.findAll('[aria-live]')).toHaveLength(1)
  })

  test('the orphan notice and the section link to the report page, and both links draw their focus ring', async () => {
    const wrapper = await setup()

    const links = [
      ...wrapper.get('[data-testid="orphaned-notice"]').findAll('a'),
      ...wrapper.get('[data-testid="orphaned-settings"]').findAll('a'),
      wrapper.get('[data-testid="version-app"]'),
      wrapper.get('[data-testid="version-api"]'),
    ]
    expect(links.map(link => drawsFocusRing(link.classes()))).toEqual(links.map(() => true))
  })

  test.each(['general', 'seo', 'maintenance', 'about'])('has no axe violations on the %s tab', async (key) => {
    const wrapper = await setup({ heading: true })
    await wrapper.get(`[data-testid="form-group-tab"][data-tab="${key}"]`).trigger('click')
    await flushPromises()

    expect(await axe(document.body)).toHaveNoViolations()
  })

  test.each(['idle', 'dirty', 'saved', 'failed', 'load error', 'scan pending'] as const)('has no axe violations when %s', async (state) => {
    if (state === 'failed') {
      mockSaveConfig.mockImplementation(async () => [{ key: 'siteName', error: Object.assign(new Error('x'), { statusCode: 500 }) }])
    }
    const wrapper = await setup({ heading: true, loadFails: state === 'load error' })
    if (['dirty', 'saved', 'failed'].includes(state)) {
      await type(wrapper, 'siteName', 'Kitchens')
    }
    if (state === 'saved' || state === 'failed') {
      await save(wrapper).trigger('click')
      await flushPromises()
    }
    if (state === 'scan pending') {
      vi.useFakeTimers()
      await wrapper.get('[data-testid="scan-orphans"]').trigger('click')
      await vi.advanceTimersByTimeAsync(60_000)
      vi.useRealTimers()
      await flushPromises()
      expect(wrapper.find('[data-testid="orphaned-scan-pending"]').exists()).toBe(true)
    }

    expect(await axe(document.body)).toHaveNoViolations()
  })
})

describe('Site settings CWA version', () => {
  beforeEach(() => {
    mockOptions.pageCache = undefined
    mockFetchOrphanReport.mockReset().mockResolvedValue(undefined)
    mockFetchFileReport.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const apiLink = (wrapper: Wrapper) => wrapper.get('[data-testid="version-api"]')
  const apiRef = (wrapper: Wrapper) => wrapper.find('[data-testid="version-api-ref"]')

  test('shows the bundle version from the brackets, never the API\'s own version, with its commit short and muted', async () => {
    const wrapper = await setup({ apiDocsVersion: '1.0.0 (2.0.0-alpha.42@3c99ba175e9c0f6f59306ccdc2f507f1b0fea48c)' })

    expect(apiLink(wrapper).text()).toBe('2.0.0-alpha.42')
    expect(apiLink(wrapper).attributes('href')).toBe('https://packagist.org/packages/components-web-app/api-components-bundle#2.0.0-alpha.42')
    expect(apiRef(wrapper).text()).toBe('3c99ba17')
    expect(apiRef(wrapper).classes()).toContain('cwa:text-fg-muted')
  })

  test('a development branch is marked unstable and links to its branch', async () => {
    const wrapper = await setup({ apiDocsVersion: '1.0.0 (dev-main@abc1234def5678901234567890abcdef12345678)' })

    expect(apiLink(wrapper).text()).toBe('dev-main (unstable)')
    expect(apiLink(wrapper).attributes('href')).toBe('https://packagist.org/packages/components-web-app/api-components-bundle#dev-main')
    expect(apiRef(wrapper).text()).toBe('abc1234d')
  })

  test('a version with no brackets is shown whole, with no commit', async () => {
    const wrapper = await setup({ apiDocsVersion: '2.0.0-beta.1+build.5' })

    expect(apiLink(wrapper).text()).toBe('2.0.0-beta.1+build.5')
    expect(apiRef(wrapper).exists()).toBe(false)
  })

  test('no version in the docs is Unknown', async () => {
    const wrapper = await setup()

    expect(apiLink(wrapper).text()).toBe('Unknown')
    expect(apiRef(wrapper).exists()).toBe(false)
  })

  test('the app version is shown whole', async () => {
    const wrapper = await setup()

    expect(wrapper.get('[data-testid="version-app"]').text()).toBe('2.0.0-alpha.32')
  })

  test('the edge package is marked unstable without shortening its version', async () => {
    const wrapper = await setup({ appPackage: { version: '2.0.0-alpha.32-20261118.3c99ba17', name: '@cwa/nuxt-edge' } })

    expect(wrapper.get('[data-testid="version-app"]').text()).toBe('2.0.0-alpha.32-20261118.3c99ba17 (unstable)')
  })
})

describe('Site settings About the CWA (#518)', () => {
  beforeEach(() => {
    mockOptions.pageCache = undefined
    mockFetchOrphanReport.mockReset().mockResolvedValue(undefined)
    mockFetchFileReport.mockReset().mockResolvedValue(undefined)
  })

  test('the About tab links to cwa.rocks in a new tab as View the official CWA website, styled as its other links', async () => {
    const wrapper = await setup({ hash: '#about' })
    const about = wrapper.findAll('a').find(link => link.text() === 'View the official CWA website')!

    expect(about.attributes('href')).toBe('https://cwa.rocks')
    expect(about.attributes('target')).toBe('_blank')
    expect(about.attributes('rel')).toBe('noopener')
    expect(about.classes()).toStrictEqual(wrapper.get('[data-testid="version-app"]').classes())
    expect(about.element.closest('[role="tabpanel"]')).toBe(wrapper.get('[data-testid="version-app"]').element.closest('[role="tabpanel"]'))
  })
})

describe('Site settings tabs (#461)', () => {
  beforeEach(() => {
    mockOptions.pageCache = undefined
    mockConfirm.mockResolvedValue(true)
    mockFetchOrphanReport.mockReset().mockResolvedValue(undefined)
    mockFetchFileReport.mockReset().mockResolvedValue(undefined)
    mockSaveConfig.mockReset().mockImplementation(async (changed: Record<string, any>) => {
      storedConfig.value = { ...storedConfig.value, ...changed }
      return []
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const tab = (wrapper: Wrapper, key: string) => wrapper.get(`[data-testid="form-group-tab"][data-tab="${key}"]`)
  const panel = (wrapper: Wrapper, key: string) => wrapper.get(`[data-testid="form-group-panel"][data-tab="${key}"]`)
  const selected = (wrapper: Wrapper) => wrapper.findAll('[data-testid="form-group-tab"]').filter(item => item.attributes('aria-selected') === 'true').map(item => item.attributes('data-tab'))
  const shown = (wrapper: Wrapper) => wrapper.findAll('[data-testid="form-group-panel"]').filter(item => !item.attributes('style')?.includes('display: none')).map(item => item.attributes('data-tab'))
  const saveLabel = (wrapper: Wrapper) => wrapper.get('[data-testid="form-group-save"]').findAll('span').filter(span => !span.classes().includes('cwa:sr-only')).map(span => span.text()).join('')

  async function select(wrapper: Wrapper, key: string) {
    await tab(wrapper, key).trigger('click')
    await flushPromises()
  }

  test('the sections are grouped into General, SEO, Maintenance and About tabs, General first', async () => {
    const wrapper = await setup()

    expect(wrapper.findAll('[role="tab"]').map(item => item.text())).toEqual(['General', 'SEO', 'Maintenance', 'About'])
    expect(selected(wrapper)).toEqual(['general'])
    expect(shown(wrapper)).toEqual(['general'])
    const contents: Record<string, string[]> = {
      general: ['[data-cwa-field="siteName"]', '[data-cwa-field="concatTitle"]', '[data-cwa-field="fallbackTitle"]', '[data-cwa-field="canonicalUrl"]'],
      seo: ['[data-cwa-field="sitemapEnabled"]', '[data-cwa-field="sitemapXml"]', '[data-cwa-field="indexable"]', '[data-cwa-field="robotsRemoveSitemap"]', '[data-cwa-field="robotsText"]'],
      maintenance: ['[data-cwa-field="maintenanceModeEnabled"]', '[data-testid="settings-cache"]', '[data-testid="orphaned-settings"]'],
      about: ['[data-testid="version-app"]', '[data-testid="version-api"]'],
    }
    for (const [key, selectors] of Object.entries(contents)) {
      for (const selector of selectors) {
        expect(panel(wrapper, key).find(selector).exists(), `${selector} in ${key}`).toBe(true)
      }
    }
    expect(panel(wrapper, 'general').findAll('h2').map(heading => heading.text())).not.toContain('General')
    expect(panel(wrapper, 'general').attributes('role')).toBe('tabpanel')
    expect(panel(wrapper, 'general').attributes('aria-labelledby')).toBe(tab(wrapper, 'general').attributes('id'))
  })

  test('Cancel and Save sit in the tab row, after the tabs, whichever tab is open', async () => {
    const wrapper = await setup()
    await select(wrapper, 'about')

    const row = wrapper.get('[data-testid="form-group-head"]')
    expect(row.find('[role="tablist"]').exists()).toBe(true)
    expect(row.findAll('[data-testid="form-group-actions"] button').map(button => button.attributes('data-testid'))).toEqual(['form-group-cancel', 'form-group-save'])
    expect(wrapper.find('[data-testid="form-group-panel"] [data-testid="form-group-actions"]').exists()).toBe(false)
  })

  test('the orphan notice stays above the tabs, whichever tab is open', async () => {
    mockFetchOrphanReport.mockResolvedValue(orphanReport())
    const wrapper = await setup()
    await select(wrapper, 'about')

    expect(wrapper.find('[data-testid="form-group-panel"] [data-testid="orphaned-notice"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="orphaned-notice"]').isVisible()).toBe(true)
  })

  test('Save counts the changes on every tab, and each tab with a change shows the unsaved dot', async () => {
    const wrapper = await setup()

    await wrapper.get('[data-cwa-field="siteName"] input').setValue('Kitchens')
    await select(wrapper, 'seo')
    await wrapper.get('[data-cwa-field="sitemapEnabled"] [role="switch"]').trigger('click')
    await flushPromises()

    expect(saveLabel(wrapper)).toBe('Save 2 changes')
    expect(tab(wrapper, 'general').attributes('data-badge')).toBe('unsaved')
    expect(tab(wrapper, 'general').attributes('aria-label')).toBe('General, 1 unsaved')
    expect(tab(wrapper, 'seo').attributes('data-badge')).toBe('unsaved')
    expect(tab(wrapper, 'about').attributes('data-badge')).toBeUndefined()
    await wrapper.get('[data-testid="form-group-save"]').trigger('click')
    await flushPromises()

    expect(mockSaveConfig).toHaveBeenCalledWith({ siteName: 'Kitchens', sitemapEnabled: false })
    expect(tab(wrapper, 'general').attributes('data-badge')).toBeUndefined()
  })

  test('an error on a hidden tab badges it, and the alert\'s field link opens that tab and focuses the field', async () => {
    const refused = Object.assign(new Error('422'), { statusCode: 422, data: { violations: [{ propertyPath: 'value', message: 'Not allowed.' }] } })
    mockSaveConfig.mockImplementation(async (changed: Record<string, any>) => Object.keys(changed).map(key => ({ key, error: refused })))
    const wrapper = await setup()

    await wrapper.get('[data-cwa-field="siteName"] input').setValue('Kitchens')
    await select(wrapper, 'seo')
    await wrapper.get('[data-cwa-field="sitemapEnabled"] [role="switch"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="form-group-save"]').trigger('click')
    await flushPromises()

    expect(selected(wrapper)).toEqual(['seo'])
    expect(tab(wrapper, 'general').attributes('data-badge')).toBe('error')
    expect(tab(wrapper, 'general').attributes('aria-label')).toBe('General, 1 to fix, 1 unsaved')
    const link = wrapper.findAll('[data-testid="form-group-alert-field"]').find(item => item.text() === 'Site name')!
    expect(link.element.parentElement!.textContent).toContain('General tab')
    await link.trigger('click')
    await flushPromises()

    expect(selected(wrapper)).toEqual(['general'])
    expect(shown(wrapper)).toEqual(['general'])
    expect(document.activeElement).toBe(wrapper.get('[data-cwa-field="siteName"] input').element)
  })

  test('a failed Save with nothing to fix on the open tab opens the first tab that has', async () => {
    const refused = Object.assign(new Error('422'), { statusCode: 422, data: { violations: [{ propertyPath: 'value', message: 'Not allowed.' }] } })
    mockSaveConfig.mockImplementation(async (changed: Record<string, any>) => Object.keys(changed).map(key => ({ key, error: refused })))
    const wrapper = await setup()

    await select(wrapper, 'seo')
    await wrapper.get('[data-cwa-field="sitemapEnabled"] [role="switch"]').trigger('click')
    await flushPromises()
    await select(wrapper, 'about')
    await wrapper.get('[data-testid="form-group-save"]').trigger('click')
    await flushPromises()

    expect(selected(wrapper)).toEqual(['seo'])
  })

  test('the URL hash picks the tab, and an unknown hash opens General', async () => {
    const wrapper = await setup({ hash: '#maintenance' })
    expect(selected(wrapper)).toEqual(['maintenance'])
    expect(shown(wrapper)).toEqual(['maintenance'])

    await currentRouter.push('/_cwa/settings#about')
    await flushPromises()
    expect(selected(wrapper)).toEqual(['about'])

    await currentRouter.push('/_cwa/settings#nothing')
    await flushPromises()
    expect(selected(wrapper)).toEqual(['general'])
  })

  test('choosing a tab replaces the URL hash, General with none, so Back after a link and a reload return to it, without asking to leave', async () => {
    const wrapper = await setup()
    await wrapper.get('[data-cwa-field="siteName"] input').setValue('Kitchens')
    await flushPromises()
    const push = vi.spyOn(currentRouter, 'push')
    const replace = vi.spyOn(currentRouter, 'replace')

    await select(wrapper, 'seo')
    expect(currentRouter.currentRoute.value.fullPath).toBe('/_cwa/settings#seo')
    await select(wrapper, 'maintenance')
    expect(currentRouter.currentRoute.value.fullPath).toBe('/_cwa/settings#maintenance')
    expect(replace).toHaveBeenCalledTimes(2)
    expect(push).not.toHaveBeenCalled()
    expect(mockConfirm).not.toHaveBeenCalled()

    await select(wrapper, 'general')
    expect(currentRouter.currentRoute.value.fullPath).toBe('/_cwa/settings')
    expect(selected(wrapper)).toEqual(['general'])

    await select(wrapper, 'maintenance')
    push.mockRestore()
    await currentRouter.push('/_cwa/settings/elsewhere')
    currentRouter.back()
    await vi.waitFor(() => expect(currentRouter.currentRoute.value.fullPath).toBe('/_cwa/settings#maintenance'))
    await flushPromises()
    expect(selected(wrapper)).toEqual(['maintenance'])
  })

  test('the page declares its hash a tab, so the router never waits for or scrolls to an element named by it', () => {
    expect(useRouter().resolve({ name: '_cwa-settings', hash: '#seo' }).meta.hashIsTab).toBe(true)
  })

  test('Alt, Meta or Ctrl with an arrow key is left to the browser, so Alt+Left goes back instead of switching tabs', async () => {
    const wrapper = await setup()

    for (const modifier of ['altKey', 'metaKey', 'ctrlKey']) {
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', [modifier]: true, bubbles: true, cancelable: true })
      tab(wrapper, 'general').element.dispatchEvent(event)
      await flushPromises()
      expect(selected(wrapper)).toEqual(['general'])
      expect(event.defaultPrevented).toBe(false)
    }
  })

  test('a change to a setting hidden by turning indexing off is still counted, badged and named', async () => {
    const wrapper = await setup()
    await select(wrapper, 'seo')
    await wrapper.get('[data-cwa-field="robotsAllowAiBots"] [role="switch"]').trigger('click')
    await wrapper.get('[data-cwa-field="indexable"] [role="switch"]').trigger('click')
    await flushPromises()

    expect(saveLabel(wrapper)).toBe('Save 2 changes')
    expect(tab(wrapper, 'seo').attributes('aria-label')).toBe('SEO, 2 unsaved')
    await wrapper.get('[data-testid="form-group-cancel"]').trigger('click')
    await flushPromises()
    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('Allow AI bots') }))
    expect(mockConfirm.mock.calls[0][0].description).not.toContain('robotsAllowAiBots')
  })

  test('the arrow keys, Home and End move between tabs and focus the tab they open', async () => {
    const wrapper = await setup()

    await tab(wrapper, 'general').trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()
    expect(selected(wrapper)).toEqual(['seo'])
    expect(document.activeElement).toBe(tab(wrapper, 'seo').element)

    await tab(wrapper, 'seo').trigger('keydown', { key: 'End' })
    await flushPromises()
    expect(selected(wrapper)).toEqual(['about'])

    await tab(wrapper, 'about').trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()
    expect(selected(wrapper)).toEqual(['general'])

    await tab(wrapper, 'general').trigger('keydown', { key: 'ArrowLeft' })
    await flushPromises()
    expect(selected(wrapper)).toEqual(['about'])

    await tab(wrapper, 'about').trigger('keydown', { key: 'Home' })
    await flushPromises()
    expect(selected(wrapper)).toEqual(['general'])
    expect(tab(wrapper, 'general').attributes('tabindex')).toBe('0')
    expect(tab(wrapper, 'seo').attributes('tabindex')).toBe('-1')
  })

  test('the tab list scrolls sideways rather than wrapping at phone width', async () => {
    const wrapper = await setup()

    const list = wrapper.get('[role="tablist"]')
    expect(list.classes()).toEqual(expect.arrayContaining(['cwa:overflow-x-auto', 'cwa:flex']))
    expect(list.classes()).not.toContain('cwa:flex-wrap')
    expect(wrapper.findAll('[role="tab"]').every(item => item.classes().includes('cwa:shrink-0') && item.classes().includes('cwa:whitespace-nowrap'))).toBe(true)
  })

  test('the tabs draw their focus ring', async () => {
    const wrapper = await setup()

    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs.map(item => drawsFocusRing(item.classes()))).toEqual(tabs.map(() => true))
  })

  test('Cancel still asks once for the changes on every tab', async () => {
    mockConfirm.mockResolvedValue(false)
    const wrapper = await setup()

    await wrapper.get('[data-cwa-field="siteName"] input').setValue('Kitchens')
    await select(wrapper, 'seo')
    await wrapper.get('[data-cwa-field="sitemapEnabled"] [role="switch"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="form-group-cancel"]').trigger('click')
    await flushPromises()

    expect(mockConfirm).toHaveBeenCalledTimes(1)
    expect(mockConfirm.mock.calls[0]![0].title).toBe('Discard 2 unsaved changes?')
    expect(saveLabel(wrapper)).toBe('Save 2 changes')
  })
})
