// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import OrphanedPage from './orphaned.vue'
import * as cwaComposable from '#cwa/composables/cwa'
import { useRouter } from '#app/composables/router'
import cwaAdmin from '#cwa-layer/middleware/cwa-admin'

const { mockReveal } = vi.hoisted(() => ({ mockReveal: vi.fn() }))

vi.mock('vuejs-confirm-dialog', () => ({
  createConfirmDialog: vi.fn(() => ({ reveal: mockReveal })),
}))

const COMPONENT = '/component/html_contents/c1'
const POSITION = '/_/component_positions/p1'
const GROUP = '/_/component_groups/g1'

function report(overrides: Record<string, any> = {}) {
  return {
    generatedAt: '2026-09-25T10:00:00+00:00',
    components: [COMPONENT],
    componentPositions: [POSITION],
    componentGroups: [GROUP],
    ...overrides,
  }
}

function deletion(deleted: Record<string, string[]> = {}, rejected: { iri: string, reason: string }[] = []) {
  return {
    deleted: { componentGroups: [], componentPositions: [], components: [], ...deleted },
    rejected,
  }
}

function statusError(statusCode?: number) {
  return Object.assign(new Error('failed'), { statusCode })
}

const mockFetchReport = vi.fn()
const mockRequestScan = vi.fn()
const mockDeleteOrphans = vi.fn()
const mockFetch = vi.fn()

async function setup() {
  // @ts-expect-error partial mock
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    fetch: mockFetch,
    orphanedResources: {
      fetchReport: mockFetchReport,
      requestScan: mockRequestScan,
      deleteOrphans: mockDeleteOrphans,
    },
  }))
  const wrapper = mount(OrphanedPage, {
    global: {
      stubs: {
        ListHeading: true,
        Spinner: true,
      },
    },
  })
  await flushPromises()
  return wrapper
}

type Wrapper = Awaited<ReturnType<typeof setup>>

function button(wrapper: Wrapper, text: string, within?: string) {
  const root = within ? wrapper.find(`[data-testid="${within}"]`) : wrapper
  return root.findAll('button').find(b => b.text() === text)
}

async function click(wrapper: Wrapper, text: string, within?: string) {
  await button(wrapper, text, within)!.trigger('click')
  await flushPromises()
}

function rowIris(wrapper: Wrapper, section: string) {
  return wrapper.find(`[data-testid="orphaned-section-${section}"]`).findAll('[data-testid="orphaned-row-iri"]').map(el => el.text())
}

describe('Orphaned resources page', () => {
  beforeEach(() => {
    mockFetchReport.mockReset().mockResolvedValue(report())
    mockRequestScan.mockReset().mockResolvedValue(undefined)
    mockDeleteOrphans.mockReset().mockResolvedValue(deletion())
    mockFetch.mockReset()
    mockReveal.mockReset().mockResolvedValue({ isCanceled: false })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  test('is the _cwa-orphaned admin route the settings page links to', () => {
    expect(useRouter().resolve({ name: '_cwa-orphaned' }).path).toBe('/_cwa/orphaned')
  })

  test('is guarded by the cwa-admin middleware, which runs on the server as well as the client', () => {
    const matched = useRouter().resolve({ name: '_cwa-orphaned' }).matched
    expect(matched.some(record => ([] as unknown[]).concat(record.meta.middleware ?? []).includes(cwaAdmin))).toBe(true)
  })

  test('before any scan it says so plainly and offers a scan', async () => {
    mockFetchReport.mockRejectedValue(statusError(404))
    const wrapper = await setup()
    expect(wrapper.find('[data-testid="orphaned-no-scan"]').text()).toContain('No scan has been run yet.')
    expect(button(wrapper, 'Scan')).toBeDefined()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="orphaned-section-components"]').exists()).toBe(false)
  })

  test('a report shows when it was generated, that it reflects that scan, and a scan again button', async () => {
    const wrapper = await setup()
    const summary = wrapper.find('[data-testid="orphaned-summary"]').text()
    expect(summary).toContain('Last scanned 25 Sep 2026')
    expect(summary).toContain('This report reflects that scan.')
    expect(button(wrapper, 'Scan again')).toBeDefined()
    expect(wrapper.find('[data-testid="orphaned-no-scan"]').exists()).toBe(false)
  })

  test('lists each section in order, components first, with the component collection', async () => {
    const wrapper = await setup()
    const sections = wrapper.findAll('[data-testid^="orphaned-section-"]').map(el => el.find('h2').text())
    expect(sections).toEqual(['Components (1)', 'Component positions (1)', 'Component groups (1)'])
    expect(rowIris(wrapper, 'components')).toEqual([COMPONENT])
    expect(rowIris(wrapper, 'componentPositions')).toEqual([POSITION])
    expect(rowIris(wrapper, 'componentGroups')).toEqual([GROUP])
    expect(wrapper.find('[data-testid="orphaned-section-components"]').text()).toContain('html_contents')
  })

  test('an empty section says there is nothing orphaned of that kind and offers no delete', async () => {
    mockFetchReport.mockResolvedValue(report({ componentPositions: [] }))
    const wrapper = await setup()
    const section = wrapper.find('[data-testid="orphaned-section-componentPositions"]')
    expect(section.text()).toContain('No orphaned component positions.')
    expect(button(wrapper, 'Delete all', 'orphaned-section-componentPositions')).toBeUndefined()
  })

  test('a report failure keeps the page and shows its status', async () => {
    mockFetchReport.mockRejectedValue(statusError(500))
    const wrapper = await setup()
    expect(wrapper.find('[role="alert"]').text()).toContain('The report could not be loaded (500). Please try again.')
    expect(wrapper.find('[data-testid="orphaned-no-scan"]').exists()).toBe(false)
  })

  test('scanning requests a scan and shows the new report', async () => {
    const wrapper = await setup()
    mockFetchReport.mockResolvedValue(report({ generatedAt: '2026-09-26T10:00:00+00:00', components: [] }))
    await click(wrapper, 'Scan again')
    expect(mockRequestScan).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="orphaned-summary"]').text()).toContain('26 Sep 2026')
    expect(rowIris(wrapper, 'components')).toEqual([])
  })

  test('a scan that has not finished within the polling bound says it was requested', async () => {
    vi.useFakeTimers()
    const wrapper = await setup()
    await button(wrapper, 'Scan again')!.trigger('click')
    await vi.advanceTimersByTimeAsync(60_000)
    await flushPromises()
    expect(wrapper.text()).toContain('The scan has been requested but has not finished yet. Reload this page in a moment to see the new report.')
  })

  test('a failed scan request shows its status', async () => {
    mockRequestScan.mockRejectedValue(statusError(403))
    const wrapper = await setup()
    await click(wrapper, 'Scan again')
    expect(wrapper.find('[role="alert"]').text()).toContain('The scan could not be requested (403). Please try again.')
  })

  test('view shows the resource data and hide removes it', async () => {
    mockFetch.mockReturnValue({ response: Promise.resolve({ _data: { '@id': GROUP, 'reference': 'orphan-group' } }) })
    const wrapper = await setup()
    await click(wrapper, 'View', 'orphaned-section-componentGroups')
    const pre = wrapper.find('[data-testid="orphaned-section-componentGroups"] pre')
    expect(pre.text()).toContain('"reference": "orphan-group"')
    await click(wrapper, 'Hide', 'orphaned-section-componentGroups')
    expect(wrapper.find('[data-testid="orphaned-section-componentGroups"] pre').exists()).toBe(false)
  })

  test('deleting a row asks first, and a cancel sends nothing', async () => {
    mockReveal.mockResolvedValue({ isCanceled: true })
    const wrapper = await setup()
    await click(wrapper, 'Delete', 'orphaned-section-componentGroups')
    expect(mockReveal).toHaveBeenCalledTimes(1)
    expect(mockDeleteOrphans).not.toHaveBeenCalled()
    expect(rowIris(wrapper, 'componentGroups')).toEqual([GROUP])
  })

  test('a confirmed delete sends that IRI, shows the re-read report and what was deleted, without rescanning', async () => {
    const wrapper = await setup()
    mockDeleteOrphans.mockResolvedValue(deletion({ componentGroups: [GROUP], componentPositions: [POSITION] }))
    mockFetchReport.mockResolvedValue(report({ componentPositions: [], componentGroups: [] }))
    await click(wrapper, 'Delete', 'orphaned-section-componentGroups')
    expect(mockDeleteOrphans).toHaveBeenCalledWith({ iris: [GROUP] })
    expect(rowIris(wrapper, 'componentGroups')).toEqual([])
    expect(rowIris(wrapper, 'componentPositions')).toEqual([])
    expect(wrapper.find('[data-testid="orphaned-delete-outcome"]').text()).toContain('Deleted 1 component position and 1 component group, including anything they contained.')
    expect(mockRequestScan).not.toHaveBeenCalled()
  })

  test('resources the API kept or found already gone are listed with the reason', async () => {
    const wrapper = await setup()
    mockDeleteOrphans.mockResolvedValue(deletion({}, [
      { iri: COMPONENT, reason: 'not_orphaned' },
      { iri: GROUP, reason: 'not_found' },
    ]))
    mockFetchReport.mockResolvedValue(report({ componentGroups: [] }))
    await click(wrapper, 'Delete everything')
    const items = wrapper.find('[data-testid="orphaned-delete-outcome"]').findAll('li').map(li => li.findAll('span').map(span => span.text()))
    expect(items).toEqual([
      [COMPONENT, 'Kept: it is in use again, or it is a draft.'],
      [GROUP, 'Already gone.'],
    ])
    expect(wrapper.find('[data-testid="orphaned-delete-outcome"]').text()).toContain('Nothing was deleted.')
    expect(rowIris(wrapper, 'components')).toEqual([COMPONENT])
    expect(rowIris(wrapper, 'componentGroups')).toEqual([])
  })

  test('a failed row delete keeps the row and shows its error', async () => {
    mockDeleteOrphans.mockRejectedValue(statusError(500))
    const wrapper = await setup()
    await click(wrapper, 'Delete', 'orphaned-section-componentGroups')
    expect(rowIris(wrapper, 'componentGroups')).toEqual([GROUP])
    expect(wrapper.find('[data-testid="orphaned-section-componentGroups"]').text()).toContain('It could not be deleted (500).')
    expect(wrapper.find('[data-testid="orphaned-delete-outcome"]').exists()).toBe(false)
  })

  test('delete all in a section sends only that section, and a failure shows on the section', async () => {
    mockDeleteOrphans.mockRejectedValue(statusError(422))
    const wrapper = await setup()
    await click(wrapper, 'Delete all', 'orphaned-section-components')
    expect(mockDeleteOrphans).toHaveBeenCalledWith({ iris: [COMPONENT] })
    expect(rowIris(wrapper, 'components')).toEqual([COMPONENT])
    expect(wrapper.find('[data-testid="orphaned-section-components"]').text()).toContain('They could not be deleted (422).')
  })

  test('delete everything asks the API for everything and is unavailable once the re-read report is empty', async () => {
    const wrapper = await setup()
    mockFetchReport.mockResolvedValue(report({ components: [], componentPositions: [], componentGroups: [] }))
    await click(wrapper, 'Delete everything')
    expect(mockDeleteOrphans).toHaveBeenCalledWith({ all: true })
    expect(button(wrapper, 'Delete everything')!.attributes('disabled')).toBeDefined()
  })

  test('a failed delete everything keeps every row and shows the error', async () => {
    mockDeleteOrphans.mockRejectedValue(statusError(403))
    const wrapper = await setup()
    await click(wrapper, 'Delete everything')
    expect(wrapper.find('[role="alert"]').text()).toContain('The orphaned resources could not be deleted (403). Please try again.')
    expect(rowIris(wrapper, 'components')).toEqual([COMPONENT])
  })
})
