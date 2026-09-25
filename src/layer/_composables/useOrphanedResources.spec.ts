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

function statusError(statusCode?: number) {
  return Object.assign(new Error('failed'), { statusCode })
}

const mockFetchReport = vi.fn()
const mockRequestScan = vi.fn()
const mockDeleteResource = vi.fn()
const mockFetch = vi.fn()

function setup() {
  // @ts-expect-error partial mock
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    fetch: mockFetch,
    orphanedResources: {
      fetchReport: mockFetchReport,
      requestScan: mockRequestScan,
      deleteResource: mockDeleteResource,
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
    mockDeleteResource.mockReset().mockResolvedValue(undefined)
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
    test('a single delete asks for confirmation, then deletes and removes the row', async () => {
      const orphans = await loaded()
      const row = orphans.sections[1]!.rows[0]!
      await orphans.deleteRow(orphans.sections[1]!, row)
      expect(mockReveal).toHaveBeenCalledWith({
        title: 'Delete this resource?',
        content: '<p>It will be permanently deleted, along with anything it contains. This cannot be undone.</p>',
      })
      expect(mockDeleteResource).toHaveBeenCalledWith(POSITION)
      expect(orphans.sections[1]!.rows).toEqual([])
    })

    test('cancelling the confirmation sends no request and keeps the row', async () => {
      mockReveal.mockResolvedValue({ isCanceled: true })
      const orphans = await loaded()
      await orphans.deleteRow(orphans.sections[1]!, orphans.sections[1]!.rows[0]!)
      expect(mockDeleteResource).not.toHaveBeenCalled()
      expect(orphans.sections[1]!.rows).toHaveLength(1)
    })

    test('a 404 means the resource has already gone, so the row is removed without an error', async () => {
      mockDeleteResource.mockRejectedValue(statusError(404))
      const orphans = await loaded()
      await orphans.deleteRow(orphans.sections[2]!, orphans.sections[2]!.rows[0]!)
      expect(orphans.sections[2]!.rows).toEqual([])
    })

    test('any other failure keeps the row and shows its error', async () => {
      mockDeleteResource.mockRejectedValue(statusError(500))
      const orphans = await loaded()
      await orphans.deleteRow(orphans.sections[2]!, orphans.sections[2]!.rows[0]!)
      expect(orphans.sections[2]!.rows).toHaveLength(1)
      expect(orphans.sections[2]!.rows[0]!.error).toBe('It could not be deleted (500).')
      expect(orphans.sections[2]!.rows[0]!.deleting).toBe(false)
    })

    test('deleting a section confirms once with its count and deletes every row in it', async () => {
      const orphans = await loaded()
      await orphans.deleteSection(orphans.sections[0]!)
      expect(mockReveal).toHaveBeenCalledTimes(1)
      expect(mockReveal).toHaveBeenCalledWith({
        title: 'Delete 2 orphaned components?',
        content: '<p>They will be permanently deleted, along with anything they contain. This cannot be undone.</p>',
      })
      expect(mockDeleteResource.mock.calls.map(call => call[0])).toEqual([COMPONENT, COMPONENT_2])
      expect(orphans.sections[0]!.rows).toEqual([])
      expect(orphans.sections[1]!.rows).toHaveLength(1)
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
      expect(mockDeleteResource).not.toHaveBeenCalled()
    })

    test('a failure inside a section keeps only the failed row', async () => {
      mockDeleteResource.mockImplementation(async (iri: string) => {
        if (iri === COMPONENT) throw statusError(500)
      })
      const orphans = await loaded()
      await orphans.deleteSection(orphans.sections[0]!)
      expect(iris(orphans.sections[0]!.rows)).toEqual([COMPONENT])
      expect(orphans.sections[0]!.rows[0]!.error).toBe('It could not be deleted (500).')
    })

    test('deleting everything confirms once, then deletes components, then positions, then groups', async () => {
      const orphans = await loaded()
      await orphans.deleteAll()
      expect(mockReveal).toHaveBeenCalledTimes(1)
      expect(mockReveal).toHaveBeenCalledWith({
        title: 'Delete all 4 orphaned resources?',
        content: '<p>Components are deleted first, then component positions, then component groups. Deleting a group also deletes the positions inside it. This cannot be undone.</p>',
      })
      expect(mockDeleteResource.mock.calls.map(call => call[0])).toEqual([COMPONENT, COMPONENT_2, POSITION, GROUP])
      expect(orphans.totalCount.value).toBe(0)
    })

    test('a later section waits until the earlier one has finished', async () => {
      const resolvers: (() => void)[] = []
      mockDeleteResource.mockImplementation(() => new Promise<void>((resolve) => {
        resolvers.push(resolve)
      }))
      const orphans = await loaded()
      const deleting = orphans.deleteAll()
      await flushPromises()
      expect(mockDeleteResource.mock.calls.map(call => call[0])).toEqual([COMPONENT, COMPONENT_2])
      resolvers.shift()!()
      await flushPromises()
      expect(mockDeleteResource).toHaveBeenCalledTimes(2)
      resolvers.shift()!()
      await flushPromises()
      expect(mockDeleteResource.mock.calls.map(call => call[0])).toEqual([COMPONENT, COMPONENT_2, POSITION])
      resolvers.shift()!()
      await flushPromises()
      resolvers.shift()!()
      await deleting
      expect(orphans.totalCount.value).toBe(0)
    })

    test('no more than four deletes are in flight at once', async () => {
      const many = Array.from({ length: 10 }, (_, i) => `/component/html_contents/m${i}`)
      mockFetchReport.mockResolvedValue(report({ components: many, componentPositions: [], componentGroups: [] }))
      let inFlight = 0
      let maxInFlight = 0
      mockDeleteResource.mockImplementation(async () => {
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise(resolve => setTimeout(resolve, 0))
        inFlight--
      })
      const orphans = await loaded()
      await orphans.deleteAll()
      expect(mockDeleteResource).toHaveBeenCalledTimes(10)
      expect(maxInFlight).toBe(4)
    })

    test('while deleting, another delete or a scan is refused', async () => {
      let resolveDelete!: () => void
      mockDeleteResource.mockReturnValue(new Promise<void>((resolve) => {
        resolveDelete = resolve
      }))
      const orphans = await loaded()
      const deleting = orphans.deleteRow(orphans.sections[1]!, orphans.sections[1]!.rows[0]!)
      await flushPromises()
      expect(orphans.busy.value).toBe(true)
      await orphans.deleteRow(orphans.sections[2]!, orphans.sections[2]!.rows[0]!)
      await orphans.scan()
      expect(mockReveal).toHaveBeenCalledTimes(1)
      expect(mockRequestScan).not.toHaveBeenCalled()
      resolveDelete()
      await deleting
      expect(orphans.busy.value).toBe(false)
    })
  })
})
