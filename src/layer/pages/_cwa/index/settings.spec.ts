// @vitest-environment nuxt
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { computed, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import SettingsPage from './settings.vue'
import * as cwaComposable from '#cwa/composables/cwa'

const { mockOptions, mockReveal, mockPurgePageCache } = vi.hoisted(() => ({
  mockOptions: { pageCache: undefined as undefined | { enabled?: boolean } },
  mockReveal: vi.fn(),
  mockPurgePageCache: vi.fn(),
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
