// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PagePurgeCache from './PagePurgeCache.vue'
import * as cwaComposable from '#cwa/composables/cwa'
import { ResourceTypeFromIri } from '#cwa/resources/resource-utils'
import { drawsFocusRing } from '../../../../../../test/utils/focus-ring'

const { mockReveal } = vi.hoisted(() => ({ mockReveal: vi.fn() }))

vi.mock('#cwa/templates/components/core/ui/Confirm.vue', () => ({ default: { name: 'Confirm' } }))

vi.mock('vuejs-confirm-dialog', () => ({
  install: vi.fn(),
  createConfirmDialog: vi.fn(() => ({ reveal: mockReveal })),
}))

const tree = [{ iri: '/_/routes//about', children: [{ iri: '/_/pages/about', children: [{ iri: '/component/html_contents/hero', children: [] }] }] }]

function setup(resourceTree: unknown = tree) {
  const purgeHttpCache = vi.fn().mockResolvedValue(undefined)
  // @ts-expect-error
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    resources: { displayResourceTree: resourceTree },
    siteConfig: { purgeHttpCache },
  }))
  const wrapper = mount(PagePurgeCache)
  return { wrapper, purgeHttpCache }
}

function purgeButton(wrapper: ReturnType<typeof setup>['wrapper']) {
  return wrapper.findAll('button').find(b => b.text() === 'Purge this page\'s cache')
}

async function clickPurge(wrapper: ReturnType<typeof setup>['wrapper']) {
  const asked = mockReveal.mock.calls.length
  await purgeButton(wrapper)!.trigger('click')
  await vi.waitFor(() => expect(mockReveal.mock.calls.length).toBeGreaterThan(asked))
  await flushPromises()
}

describe('PagePurgeCache (#484)', () => {
  beforeEach(() => {
    ResourceTypeFromIri.setPathPrefix(undefined)
    mockReveal.mockResolvedValue({ isCanceled: false })
  })

  afterEach(() => {
    ResourceTypeFromIri.setPathPrefix(undefined)
    vi.restoreAllMocks()
    mockReveal.mockReset()
  })

  test('confirms, then purges the displayed page\'s route path and IRIs in one request', async () => {
    const { wrapper, purgeHttpCache } = setup()
    await clickPurge(wrapper)
    expect(mockReveal).toHaveBeenCalledWith({
      title: 'Purge this page\'s cache?',
      description: 'This page\'s cached copy and the API data it is built from will be dropped and rebuilt on its next visit. Pages sharing its layout or components are rebuilt too. No content will be lost.',
      keep: 'Cancel',
      go: 'Purge cache',
      tone: 'accent',
    })
    expect(purgeHttpCache).toHaveBeenCalledTimes(1)
    expect(purgeHttpCache).toHaveBeenCalledWith({
      paths: ['/about'],
      tags: ['/_/routes//about', '/_/pages/about', '/component/html_contents/hero', 'manifest:/_/pages/about'],
    })
    expect(wrapper.text()).toContain('This page\'s cache has been purged. It will be rebuilt on its next visit.')
  })

  test('purges nothing when the confirmation is cancelled', async () => {
    mockReveal.mockResolvedValue({ isCanceled: true })
    const { wrapper, purgeHttpCache } = setup()
    await clickPurge(wrapper)
    expect(purgeHttpCache).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('has been purged')
  })

  test('is not offered when there is no displayed manifest, since a request without tags would flush everything', () => {
    expect(purgeButton(setup(null).wrapper)).toBeUndefined()
    expect(purgeButton(setup([]).wrapper)).toBeUndefined()
  })

  test('disables the button while the purge is in flight', async () => {
    let resolvePurge!: () => void
    const { wrapper, purgeHttpCache } = setup()
    purgeHttpCache.mockReturnValue(new Promise<void>((resolve) => {
      resolvePurge = resolve
    }))
    await clickPurge(wrapper)
    expect(purgeButton(wrapper)!.attributes('aria-busy')).toBe('true')
    await purgeButton(wrapper)!.trigger('click')
    await flushPromises()
    expect(purgeHttpCache).toHaveBeenCalledTimes(1)
    resolvePurge()
    await flushPromises()
    expect(purgeButton(wrapper)!.attributes('aria-busy')).toBeUndefined()
  })

  test.each([
    [403, 'This page\'s cache could not be purged: your account does not have permission to do this.'],
    [401, 'This page\'s cache could not be purged: your account does not have permission to do this.'],
    [501, 'Nothing was purged. This deployment\'s cache cannot purge single pages.'],
    [422, 'Nothing was purged. The API did not accept this page\'s cache tags.'],
    [502, 'This page\'s cache could not be purged (502). Please try again.'],
    [undefined, 'This page\'s cache could not be purged (network error). Please try again.'],
  ])('a %s failure says so', async (statusCode, message) => {
    const { wrapper, purgeHttpCache } = setup()
    purgeHttpCache.mockRejectedValue(Object.assign(new Error('failed'), { statusCode }))
    await clickPurge(wrapper)
    expect(wrapper.text()).toContain(message)
    expect(wrapper.text()).not.toContain('has been purged')
    expect(wrapper.find('[data-testid="page-purge-result"]').classes()).toContain('cwa:text-danger-fg')
  })

  test('is a kit button that draws its focus ring, and the outcome is announced', async () => {
    const { wrapper } = setup()
    expect(drawsFocusRing(purgeButton(wrapper)!.classes())).toBe(true)
    await clickPurge(wrapper)
    const result = wrapper.find('[data-testid="page-purge-result"]')
    expect(result.attributes('role')).toBe('status')
    expect(result.classes()).toContain('cwa:text-fg-muted')
  })
})
