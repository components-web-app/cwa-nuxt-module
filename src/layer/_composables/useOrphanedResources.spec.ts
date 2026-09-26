// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { useOrphanedResources } from './useOrphanedResources'
import * as cwaComposable from '#cwa/composables/cwa'
import { ResourceTypeFromIri } from '#cwa/resources/resource-utils'

const { mockReveal } = vi.hoisted(() => ({ mockReveal: vi.fn() }))

vi.mock('vuejs-confirm-dialog', () => ({
  createConfirmDialog: vi.fn(() => ({ reveal: mockReveal })),
}))

const COMPONENT = '/component/html_contents/c1'
const COMPONENT_2 = '/component/images/c2'
const POSITION = '/_/component_positions/p1'
const GROUP = '/_/component_groups/g1'

function report(overrides: Record<string, any> = {}) {
  return {
    generatedAt: '2026-09-25T10:00:00+00:00',
    components: [COMPONENT, COMPONENT_2],
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

function setup() {
  // @ts-expect-error partial mock
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    fetch: mockFetch,
    orphanedResources: {
      fetchReport: mockFetchReport,
      requestScan: mockRequestScan,
      deleteOrphans: mockDeleteOrphans,
    },
  }))
  return useOrphanedResources()
}

async function loaded() {
  const orphans = setup()
  await orphans.loadReport()
  return orphans
}

function iris(rows: { iri: string }[]) {
  return rows.map(row => row.iri)
}

describe('useOrphanedResources', () => {
  beforeEach(() => {
    ResourceTypeFromIri.setPathPrefix(undefined)
    mockFetchReport.mockReset().mockResolvedValue(report())
    mockRequestScan.mockReset().mockResolvedValue(undefined)
    mockDeleteOrphans.mockReset().mockResolvedValue(deletion())
    mockFetch.mockReset()
    mockReveal.mockReset().mockResolvedValue({ isCanceled: false })
  })

  afterEach(() => {
    ResourceTypeFromIri.setPathPrefix(undefined)
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('the report', () => {
    test('a 404 is the no-scan state', async () => {
      mockFetchReport.mockRejectedValue(statusError(404))
      const orphans = await loaded()
      expect(orphans.hasReport.value).toBe(false)
      expect(orphans.totalCount.value).toBe(0)
    })

    test('a failed load leaves it unknown rather than claiming no scan', async () => {
      mockFetchReport.mockRejectedValue(statusError(500))
      const orphans = await loaded()
      expect(orphans.hasReport.value).toBeUndefined()
      expect(orphans.loadError.value).toBe('The report could not be loaded (500). Please try again.')
    })

    test('a stored report is split into its three sections, components first', async () => {
      const orphans = await loaded()
      expect(orphans.hasReport.value).toBe(true)
      expect(orphans.generatedAt.value).toBe('2026-09-25T10:00:00+00:00')
      expect(orphans.sections.map(section => section.key)).toEqual(['components', 'componentPositions', 'componentGroups'])
      expect(orphans.sections.map(section => iris(section.rows))).toEqual([[COMPONENT, COMPONENT_2], [POSITION], [GROUP]])
      expect(orphans.totalCount.value).toBe(4)
    })

    test('a component row carries its collection name from the IRI', async () => {
      const orphans = await loaded()
      expect(orphans.sections[0]!.rows.map(row => row.collection)).toEqual(['html_contents', 'images'])
      expect(orphans.sections[1]!.rows[0]!.collection).toBeUndefined()
    })

    test('the collection name is read after the API path prefix', async () => {
      ResourceTypeFromIri.setPathPrefix('/_api')
      mockFetchReport.mockResolvedValue(report({ components: ['/_api/component/html_contents/c1'] }))
      const orphans = await loaded()
      expect(orphans.sections[0]!.rows[0]!.collection).toBe('html_contents')
    })

    test('a scan rebuilds the rows from the new report', async () => {
      const orphans = await loaded()
      mockFetchReport.mockResolvedValue(report({ generatedAt: '2026-09-25T11:00:00+00:00', components: [], componentGroups: [] }))
      await orphans.scan()
      expect(orphans.sections.map(section => iris(section.rows))).toEqual([[], [POSITION], []])
      expect(orphans.generatedAt.value).toBe('2026-09-25T11:00:00+00:00')
    })
  })

  describe('viewing a resource', () => {
    test('fetches the published version of a component and keeps its data', async () => {
      const orphans = await loaded()
      mockFetch.mockReturnValue({ response: Promise.resolve({ _data: { '@id': COMPONENT, 'html': '<p>x</p>' } }) })
      const row = orphans.sections[0]!.rows[0]!
      await orphans.toggleView(row)
      expect(mockFetch).toHaveBeenCalledWith({ path: `${COMPONENT}?published=true`, noQuery: true })
      expect(row.viewOpen).toBe(true)
      expect(row.viewData).toEqual({ '@id': COMPONENT, 'html': '<p>x</p>' })
    })

    test('toggling again hides it without fetching again', async () => {
      const orphans = await loaded()
      mockFetch.mockReturnValue({ response: Promise.resolve({ _data: {} }) })
      const row = orphans.sections[1]!.rows[0]!
      await orphans.toggleView(row)
      await orphans.toggleView(row)
      expect(row.viewOpen).toBe(false)
      await orphans.toggleView(row)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith({ path: POSITION, noQuery: true })
    })

    test('a failed fetch is shown on the row', async () => {
      const orphans = await loaded()
      mockFetch.mockReturnValue({ response: Promise.reject(statusError(500)) })
      const row = orphans.sections[2]!.rows[0]!
      await orphans.toggleView(row)
      expect(row.viewError).toBe('The resource could not be loaded (500).')
      expect(row.viewData).toBeUndefined()
    })
  })

  describe('deleting', () => {
    test('a single delete asks for confirmation, then sends only that IRI', async () => {
      const orphans = await loaded()
      await orphans.deleteRow(orphans.sections[1]!.rows[0]!)
      expect(mockReveal).toHaveBeenCalledWith({
        title: 'Delete this resource?',
        content: '<p>It will be checked again first, then permanently deleted along with anything it contains. This cannot be undone.</p>',
      })
      expect(mockDeleteOrphans).toHaveBeenCalledTimes(1)
      expect(mockDeleteOrphans).toHaveBeenCalledWith({ iris: [POSITION] })
    })

    test('cancelling the confirmation sends no request, keeps the row and does not re-read the report', async () => {
      mockReveal.mockResolvedValue({ isCanceled: true })
      const orphans = await loaded()
      await orphans.deleteRow(orphans.sections[1]!.rows[0]!)
      expect(mockDeleteOrphans).not.toHaveBeenCalled()
      expect(mockFetchReport).toHaveBeenCalledTimes(1)
      expect(orphans.sections[1]!.rows).toHaveLength(1)
    })

    test('deleting a section confirms once with its count and sends that section\'s IRIs in one request', async () => {
      const orphans = await loaded()
      await orphans.deleteSection(orphans.sections[0]!)
      expect(mockReveal).toHaveBeenCalledTimes(1)
      expect(mockReveal).toHaveBeenCalledWith({
        title: 'Delete 2 orphaned components?',
        content: '<p>Each is checked again first, then permanently deleted along with anything it contains. This cannot be undone.</p>',
      })
      expect(mockDeleteOrphans).toHaveBeenCalledTimes(1)
      expect(mockDeleteOrphans).toHaveBeenCalledWith({ iris: [COMPONENT, COMPONENT_2] })
    })

    test('a section of one is named in the singular', async () => {
      const orphans = await loaded()
      await orphans.deleteSection(orphans.sections[2]!)
      expect(mockReveal.mock.calls[0]![0].title).toBe('Delete 1 orphaned component group?')
    })

    test('cancelling a section delete sends nothing', async () => {
      mockReveal.mockResolvedValue({ isCanceled: true })
      const orphans = await loaded()
      await orphans.deleteSection(orphans.sections[0]!)
      expect(mockDeleteOrphans).not.toHaveBeenCalled()
    })

    test('an empty section asks nothing and sends nothing', async () => {
      mockFetchReport.mockResolvedValue(report({ components: [] }))
      const orphans = await loaded()
      await orphans.deleteSection(orphans.sections[0]!)
      expect(mockReveal).not.toHaveBeenCalled()
      expect(mockDeleteOrphans).not.toHaveBeenCalled()
    })

    test('deleting everything confirms once, then asks the API for everything in one request', async () => {
      const orphans = await loaded()
      await orphans.deleteAll()
      expect(mockReveal).toHaveBeenCalledTimes(1)
      expect(mockReveal).toHaveBeenCalledWith({
        title: 'Delete all 4 orphaned resources?',
        content: '<p>Everything is checked again first. Whatever is still unused is permanently deleted along with anything it contains, including anything that has become unused since the last scan. This cannot be undone.</p>',
      })
      expect(mockDeleteOrphans).toHaveBeenCalledTimes(1)
      expect(mockDeleteOrphans).toHaveBeenCalledWith({ all: true })
    })

    test('cancelling delete everything sends nothing', async () => {
      mockReveal.mockResolvedValue({ isCanceled: true })
      const orphans = await loaded()
      await orphans.deleteAll()
      expect(mockDeleteOrphans).not.toHaveBeenCalled()
    })

    test('delete everything with nothing listed asks nothing and sends nothing', async () => {
      mockFetchReport.mockResolvedValue(report({ components: [], componentPositions: [], componentGroups: [] }))
      const orphans = await loaded()
      await orphans.deleteAll()
      expect(mockReveal).not.toHaveBeenCalled()
      expect(mockDeleteOrphans).not.toHaveBeenCalled()
    })

    test('only delete everything asks for everything', async () => {
      const orphans = await loaded()
      await orphans.deleteRow(orphans.sections[0]!.rows[0]!)
      await orphans.deleteSection(orphans.sections[2]!)
      expect(mockDeleteOrphans.mock.calls.map(call => call[0])).toEqual([{ iris: [COMPONENT] }, { iris: [GROUP] }])
    })

    test('after a delete the rows come from the re-read report, so cascaded removals go too', async () => {
      const orphans = await loaded()
      mockDeleteOrphans.mockResolvedValue(deletion({ componentGroups: [GROUP], componentPositions: [POSITION] }))
      mockFetchReport.mockResolvedValue(report({ generatedAt: '2026-09-25T11:00:00+00:00', componentPositions: [], componentGroups: [] }))
      await orphans.deleteRow(orphans.sections[2]!.rows[0]!)
      expect(mockFetchReport).toHaveBeenCalledTimes(2)
      expect(orphans.sections.map(section => iris(section.rows))).toEqual([[COMPONENT, COMPONENT_2], [], []])
      expect(orphans.generatedAt.value).toBe('2026-09-25T11:00:00+00:00')
      expect(mockRequestScan).not.toHaveBeenCalled()
    })

    test('the outcome counts what was deleted of each kind, cascaded items included', async () => {
      const orphans = await loaded()
      mockDeleteOrphans.mockResolvedValue(deletion({ components: [COMPONENT, COMPONENT_2], componentPositions: [POSITION], componentGroups: [GROUP, '/_/component_groups/g2'] }))
      await orphans.deleteAll()
      expect(orphans.deleteOutcome.value?.summary).toBe('Deleted 2 components, 1 component position and 2 component groups, including anything they contained.')
      expect(orphans.deleteOutcome.value?.rejected).toEqual([])
    })

    test('the outcome names only the kinds that were deleted', async () => {
      const orphans = await loaded()
      mockDeleteOrphans.mockResolvedValue(deletion({ componentGroups: [GROUP] }))
      await orphans.deleteSection(orphans.sections[2]!)
      expect(orphans.deleteOutcome.value?.summary).toBe('Deleted 1 component group, including anything they contained.')
    })

    test('an outcome that deleted nothing says so', async () => {
      const orphans = await loaded()
      mockDeleteOrphans.mockResolvedValue(deletion({}, [{ iri: POSITION, reason: 'not_orphaned' }]))
      await orphans.deleteRow(orphans.sections[1]!.rows[0]!)
      expect(orphans.deleteOutcome.value?.summary).toBe('Nothing was deleted.')
    })

    test('each rejected resource is listed with a readable reason', async () => {
      const orphans = await loaded()
      mockDeleteOrphans.mockResolvedValue(deletion({ components: [COMPONENT_2] }, [
        { iri: COMPONENT, reason: 'not_orphaned' },
        { iri: GROUP, reason: 'not_found' },
        { iri: POSITION, reason: 'something_new' },
      ]))
      await orphans.deleteAll()
      expect(orphans.deleteOutcome.value?.rejected).toEqual([
        { iri: COMPONENT, reason: 'Kept: it is in use again, or it is a draft.' },
        { iri: GROUP, reason: 'Already gone.' },
        { iri: POSITION, reason: 'Not deleted.' },
      ])
    })

    test('a re-read that fails removes what was deleted, and what had already gone, locally', async () => {
      const orphans = await loaded()
      mockDeleteOrphans.mockResolvedValue(deletion({ components: [COMPONENT], componentGroups: [GROUP] }, [
        { iri: POSITION, reason: 'not_found' },
        { iri: COMPONENT_2, reason: 'not_orphaned' },
      ]))
      mockFetchReport.mockRejectedValue(statusError(500))
      await orphans.deleteAll()
      expect(orphans.sections.map(section => iris(section.rows))).toEqual([[COMPONENT_2], [], []])
      expect(orphans.deleteOutcome.value?.summary).toBe('Deleted 1 component and 1 component group, including anything they contained.')
      expect(orphans.loadError.value).toBeUndefined()
    })

    test('a re-read that finds no report also removes what was deleted locally', async () => {
      const orphans = await loaded()
      mockDeleteOrphans.mockResolvedValue(deletion({ componentGroups: [GROUP] }))
      mockFetchReport.mockRejectedValue(statusError(404))
      await orphans.deleteSection(orphans.sections[2]!)
      expect(orphans.sections[2]!.rows).toEqual([])
      expect(orphans.hasReport.value).toBe(true)
    })

    test('a failed row delete keeps every row, shows the error on it and does not re-read', async () => {
      mockDeleteOrphans.mockRejectedValue(statusError(422))
      const orphans = await loaded()
      await orphans.deleteRow(orphans.sections[2]!.rows[0]!)
      expect(orphans.totalCount.value).toBe(4)
      expect(orphans.sections[2]!.rows[0]!.error).toBe('It could not be deleted (422).')
      expect(orphans.sections[2]!.rows[0]!.deleting).toBe(false)
      expect(orphans.deleteOutcome.value).toBeUndefined()
      expect(mockFetchReport).toHaveBeenCalledTimes(1)
    })

    test('a failed section delete keeps its rows and shows the error on the section', async () => {
      mockDeleteOrphans.mockRejectedValue(statusError(403))
      const orphans = await loaded()
      await orphans.deleteSection(orphans.sections[0]!)
      expect(iris(orphans.sections[0]!.rows)).toEqual([COMPONENT, COMPONENT_2])
      expect(orphans.sections[0]!.error).toBe('They could not be deleted (403).')
      expect(orphans.sections[0]!.rows.every(row => !row.deleting)).toBe(true)
    })

    test('a failed delete everything keeps every row and shows the error', async () => {
      mockDeleteOrphans.mockRejectedValue(statusError())
      const orphans = await loaded()
      await orphans.deleteAll()
      expect(orphans.totalCount.value).toBe(4)
      expect(orphans.deleteError.value).toBe('The orphaned resources could not be deleted (network error). Please try again.')
    })

    test('the rows being deleted are marked while the request is in flight', async () => {
      let resolveDelete!: (value: unknown) => void
      mockDeleteOrphans.mockReturnValue(new Promise((resolve) => {
        resolveDelete = resolve
      }))
      const orphans = await loaded()
      const deleting = orphans.deleteSection(orphans.sections[0]!)
      await flushPromises()
      expect(orphans.sections.map(section => section.rows.map(row => row.deleting))).toEqual([[true, true], [false], [false]])
      resolveDelete(deletion())
      await deleting
    })

    test('a new delete clears the previous outcome and errors', async () => {
      mockDeleteOrphans.mockRejectedValueOnce(statusError(500))
      const orphans = await loaded()
      await orphans.deleteAll()
      await orphans.deleteRow(orphans.sections[1]!.rows[0]!)
      expect(orphans.deleteError.value).toBeUndefined()
      expect(orphans.deleteOutcome.value?.summary).toBe('Nothing was deleted.')
    })

    test('a scan clears the delete outcome', async () => {
      const orphans = await loaded()
      await orphans.deleteAll()
      mockFetchReport.mockResolvedValue(report({ generatedAt: '2026-09-25T12:00:00+00:00' }))
      await orphans.scan()
      expect(orphans.deleteOutcome.value).toBeUndefined()
    })

    test('while deleting, another delete or a scan is refused', async () => {
      let resolveDelete!: (value: unknown) => void
      mockDeleteOrphans.mockReturnValue(new Promise((resolve) => {
        resolveDelete = resolve
      }))
      const orphans = await loaded()
      const deleting = orphans.deleteRow(orphans.sections[1]!.rows[0]!)
      await flushPromises()
      expect(orphans.busy.value).toBe(true)
      await orphans.deleteRow(orphans.sections[2]!.rows[0]!)
      await orphans.scan()
      expect(mockReveal).toHaveBeenCalledTimes(1)
      expect(mockRequestScan).not.toHaveBeenCalled()
      resolveDelete(deletion())
      await deleting
      expect(orphans.busy.value).toBe(false)
    })
  })
})
