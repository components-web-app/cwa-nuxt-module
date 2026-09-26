// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { useOrphanedFiles } from './useOrphanedFiles'
import * as cwaComposable from '#cwa/composables/cwa'

const { mockReveal } = vi.hoisted(() => ({ mockReveal: vi.fn() }))

vi.mock('vuejs-confirm-dialog', () => ({
  createConfirmDialog: vi.fn(() => ({ reveal: mockReveal })),
}))

const A = { adapter: 'local', path: 'files/a.png' }
const B_LOCAL = { adapter: 'local', path: 'files/b.png' }
const B_S3 = { adapter: 's3', path: 'files/b.png' }
const MISSING = { resource: '/component/images/i1', adapter: 'local', path: 'files/gone.png' }
const MISSING_PAGE_DATA = { resource: '/page_data/pd1', adapter: 's3', path: 'files/gone-too.png' }

function report(overrides: Record<string, any> = {}) {
  return {
    generatedAt: '2026-09-25T10:00:00.123456+00:00',
    orphanedFiles: [A, B_LOCAL, B_S3],
    missingFiles: [MISSING, MISSING_PAGE_DATA],
    ...overrides,
  }
}

function deletion(deleted: { adapter: string, path: string }[] = [], rejected: { path: string, reason: string }[] = []) {
  return { deleted, rejected }
}

function statusError(statusCode?: number) {
  return Object.assign(new Error('failed'), { statusCode })
}

const mockFetchFileReport = vi.fn()
const mockRequestFileScan = vi.fn()
const mockDeleteOrphanedFiles = vi.fn()
const mockDeleteOrphans = vi.fn()
const mockFetch = vi.fn()

function setup() {
  // @ts-expect-error partial mock
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    fetch: mockFetch,
    orphanedResources: {
      fetchFileReport: mockFetchFileReport,
      requestFileScan: mockRequestFileScan,
      deleteOrphanedFiles: mockDeleteOrphanedFiles,
      deleteOrphans: mockDeleteOrphans,
    },
  }))
  return useOrphanedFiles()
}

async function loaded() {
  const files = setup()
  await files.loadReport()
  return files
}

function files(rows: { adapter: string, path: string }[]) {
  return rows.map(({ adapter, path }) => ({ adapter, path }))
}

describe('useOrphanedFiles', () => {
  beforeEach(() => {
    mockFetchFileReport.mockReset().mockResolvedValue(report())
    mockRequestFileScan.mockReset().mockResolvedValue(undefined)
    mockDeleteOrphanedFiles.mockReset().mockResolvedValue(deletion())
    mockDeleteOrphans.mockReset()
    mockFetch.mockReset()
    mockReveal.mockReset().mockResolvedValue({ isCanceled: false })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('the report', () => {
    test('a 404 is the no-scan state', async () => {
      mockFetchFileReport.mockRejectedValue(statusError(404))
      const orphans = await loaded()
      expect(orphans.hasReport.value).toBe(false)
      expect(orphans.totalCount.value).toBe(0)
      expect(orphans.missingFiles.rows).toEqual([])
    })

    test('a failed load leaves it unknown rather than claiming no scan', async () => {
      mockFetchFileReport.mockRejectedValue(statusError(500))
      const orphans = await loaded()
      expect(orphans.hasReport.value).toBeUndefined()
      expect(orphans.loadError.value).toBe('The report could not be loaded (500). Please try again.')
    })

    test('a stored report lists orphaned files and missing files apart, each with its adapter', async () => {
      const orphans = await loaded()
      expect(orphans.hasReport.value).toBe(true)
      expect(orphans.generatedAt.value).toBe('2026-09-25T10:00:00.123456+00:00')
      expect(files(orphans.orphanedFiles.rows)).toEqual([A, B_LOCAL, B_S3])
      expect(orphans.missingFiles.rows.map(({ iri, adapter, path }) => ({ resource: iri, adapter, path }))).toEqual([MISSING, MISSING_PAGE_DATA])
      expect(orphans.totalCount.value).toBe(3)
    })

    test('one path on two adapters is two rows with distinct keys', async () => {
      const orphans = await loaded()
      const keys = orphans.orphanedFiles.rows.map(row => row.key)
      expect(new Set(keys).size).toBe(3)
    })

    test('a scan requests a file scan and rebuilds both lists from the new report', async () => {
      const orphans = await loaded()
      mockFetchFileReport.mockResolvedValue(report({ generatedAt: '2026-09-25T11:00:00+00:00', orphanedFiles: [A], missingFiles: [] }))
      await orphans.scan()
      expect(mockRequestFileScan).toHaveBeenCalledTimes(1)
      expect(files(orphans.orphanedFiles.rows)).toEqual([A])
      expect(orphans.missingFiles.rows).toEqual([])
    })
  })

  describe('viewing the resource a missing file belongs to', () => {
    test('fetches the published version of a component', async () => {
      const orphans = await loaded()
      mockFetch.mockReturnValue({ response: Promise.resolve({ _data: { '@id': MISSING.resource, 'file': null } }) })
      const row = orphans.missingFiles.rows[0]!
      await orphans.toggleView(row)
      expect(mockFetch).toHaveBeenCalledWith({ path: `${MISSING.resource}?published=true`, noQuery: true })
      expect(row.viewData).toEqual({ '@id': MISSING.resource, 'file': null })
    })

    test('a never-published draft component is fetched by its own IRI (#359)', async () => {
      const orphans = await loaded()
      mockFetch
        .mockReturnValueOnce({ response: Promise.reject(statusError(404)) })
        .mockReturnValueOnce({ response: Promise.resolve({ _data: { '@id': MISSING.resource } }) })
      const row = orphans.missingFiles.rows[0]!
      await orphans.toggleView(row)
      expect(mockFetch).toHaveBeenNthCalledWith(2, { path: MISSING.resource, noQuery: true })
      expect(row.viewData).toEqual({ '@id': MISSING.resource })
    })

    test('a resource that is not a component is fetched as it is, and a failure shows on the row', async () => {
      const orphans = await loaded()
      mockFetch.mockReturnValue({ response: Promise.reject(statusError(404)) })
      const row = orphans.missingFiles.rows[1]!
      await orphans.toggleView(row)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith({ path: MISSING_PAGE_DATA.resource, noQuery: true })
      expect(row.viewError).toBe('The resource could not be loaded (404).')
    })
  })

  describe('deleting', () => {
    test('a single delete asks for confirmation, then sends only that path', async () => {
      const orphans = await loaded()
      await orphans.deleteRow(orphans.orphanedFiles.rows[0]!)
      expect(mockReveal).toHaveBeenCalledWith({
        title: 'Delete this file?',
        content: '<p>It will be checked again first, then permanently deleted from storage, from every adapter where it is orphaned. This cannot be undone.</p>',
      })
      expect(mockDeleteOrphanedFiles).toHaveBeenCalledTimes(1)
      expect(mockDeleteOrphanedFiles).toHaveBeenCalledWith({ paths: [A.path] })
      expect(mockDeleteOrphans).not.toHaveBeenCalled()
    })

    test('cancelling the confirmation sends no request, keeps the row and does not re-read the report', async () => {
      mockReveal.mockResolvedValue({ isCanceled: true })
      const orphans = await loaded()
      await orphans.deleteRow(orphans.orphanedFiles.rows[0]!)
      expect(mockDeleteOrphanedFiles).not.toHaveBeenCalled()
      expect(mockFetchFileReport).toHaveBeenCalledTimes(1)
      expect(orphans.orphanedFiles.rows).toHaveLength(3)
    })

    test('delete all confirms once with the count and sends the listed paths in one request', async () => {
      const orphans = await loaded()
      await orphans.deleteSection()
      expect(mockReveal).toHaveBeenCalledTimes(1)
      expect(mockReveal).toHaveBeenCalledWith({
        title: 'Delete 3 orphaned files?',
        content: '<p>Each is checked again first, then permanently deleted from storage. This cannot be undone.</p>',
      })
      expect(mockDeleteOrphanedFiles).toHaveBeenCalledTimes(1)
      expect(mockDeleteOrphanedFiles).toHaveBeenCalledWith({ paths: [A.path, B_LOCAL.path, B_S3.path] })
    })

    test('a list of one file is named in the singular', async () => {
      mockFetchFileReport.mockResolvedValue(report({ orphanedFiles: [A] }))
      const orphans = await loaded()
      await orphans.deleteSection()
      expect(mockReveal.mock.calls[0]![0].title).toBe('Delete 1 orphaned file?')
    })

    test('delete everything confirms once, then asks the API for every orphaned file in one request', async () => {
      const orphans = await loaded()
      await orphans.deleteAll()
      expect(mockReveal).toHaveBeenCalledWith({
        title: 'Delete all 3 orphaned files?',
        content: '<p>Everything is checked again first. Whatever is still unused is permanently deleted from storage, including anything that has become unused since the last scan. Missing files are never deleted. This cannot be undone.</p>',
      })
      expect(mockDeleteOrphanedFiles).toHaveBeenCalledTimes(1)
      expect(mockDeleteOrphanedFiles).toHaveBeenCalledWith({ all: true })
    })

    test('cancelling delete all or delete everything sends nothing', async () => {
      mockReveal.mockResolvedValue({ isCanceled: true })
      const orphans = await loaded()
      await orphans.deleteSection()
      await orphans.deleteAll()
      expect(mockDeleteOrphanedFiles).not.toHaveBeenCalled()
    })

    test('missing files are never deletable: a report with only missing files asks nothing and sends nothing', async () => {
      mockFetchFileReport.mockResolvedValue(report({ orphanedFiles: [] }))
      const orphans = await loaded()
      await orphans.deleteSection()
      await orphans.deleteAll()
      expect(orphans.totalCount.value).toBe(0)
      expect(mockReveal).not.toHaveBeenCalled()
      expect(mockDeleteOrphanedFiles).not.toHaveBeenCalled()
    })

    test('delete all never sends a missing file\'s path', async () => {
      const orphans = await loaded()
      await orphans.deleteSection()
      const sent = mockDeleteOrphanedFiles.mock.calls[0]![0].paths
      expect(sent).not.toContain(MISSING.path)
      expect(sent).not.toContain(MISSING_PAGE_DATA.path)
    })

    test('only delete everything asks for everything', async () => {
      const orphans = await loaded()
      await orphans.deleteRow(orphans.orphanedFiles.rows[1]!)
      await orphans.deleteSection()
      expect(mockDeleteOrphanedFiles.mock.calls.map(call => call[0])).toEqual([
        { paths: [B_LOCAL.path] },
        { paths: [A.path, B_LOCAL.path, B_S3.path] },
      ])
    })

    test('after a delete the rows come from the re-read report', async () => {
      const orphans = await loaded()
      mockDeleteOrphanedFiles.mockResolvedValue(deletion([A]))
      mockFetchFileReport.mockResolvedValue(report({ generatedAt: '2026-09-25T11:00:00+00:00', orphanedFiles: [B_LOCAL, B_S3] }))
      await orphans.deleteRow(orphans.orphanedFiles.rows[0]!)
      expect(mockFetchFileReport).toHaveBeenCalledTimes(2)
      expect(files(orphans.orphanedFiles.rows)).toEqual([B_LOCAL, B_S3])
      expect(orphans.generatedAt.value).toBe('2026-09-25T11:00:00+00:00')
      expect(mockRequestFileScan).not.toHaveBeenCalled()
    })

    test('the outcome counts the files deleted', async () => {
      const orphans = await loaded()
      mockDeleteOrphanedFiles.mockResolvedValue(deletion([A, B_LOCAL, B_S3]))
      await orphans.deleteAll()
      expect(orphans.deleteOutcome.value).toEqual({ summary: 'Deleted 3 files.', rejected: [] })
    })

    test('one file deleted is named in the singular, and nothing deleted says so', async () => {
      const orphans = await loaded()
      mockDeleteOrphanedFiles.mockResolvedValueOnce(deletion([A]))
      await orphans.deleteRow(orphans.orphanedFiles.rows[0]!)
      expect(orphans.deleteOutcome.value?.summary).toBe('Deleted 1 file.')
      mockDeleteOrphanedFiles.mockResolvedValueOnce(deletion([], [{ path: B_LOCAL.path, reason: 'not_orphaned' }]))
      await orphans.deleteRow(orphans.orphanedFiles.rows[1]!)
      expect(orphans.deleteOutcome.value?.summary).toBe('Nothing was deleted.')
    })

    test('each rejected path is listed with a readable reason, delete_failed included', async () => {
      const orphans = await loaded()
      mockDeleteOrphanedFiles.mockResolvedValue(deletion([], [
        { path: A.path, reason: 'not_orphaned' },
        { path: B_LOCAL.path, reason: 'not_found' },
        { path: B_S3.path, reason: 'delete_failed' },
        { path: 'files/x.png', reason: 'something_new' },
      ]))
      await orphans.deleteAll()
      expect(orphans.deleteOutcome.value?.rejected).toEqual([
        { path: A.path, reason: 'Kept: something references it again.' },
        { path: B_LOCAL.path, reason: 'Already gone.' },
        { path: B_S3.path, reason: 'Could not be deleted from storage.' },
        { path: 'files/x.png', reason: 'Not deleted.' },
      ])
    })

    test('a re-read that fails removes what was deleted, and what had already gone, locally', async () => {
      const orphans = await loaded()
      mockDeleteOrphanedFiles.mockResolvedValue(deletion([B_S3], [
        { path: A.path, reason: 'not_found' },
        { path: B_LOCAL.path, reason: 'delete_failed' },
      ]))
      mockFetchFileReport.mockRejectedValue(statusError(500))
      await orphans.deleteAll()
      expect(files(orphans.orphanedFiles.rows)).toEqual([B_LOCAL])
      expect(orphans.missingFiles.rows).toHaveLength(2)
      expect(orphans.loadError.value).toBeUndefined()
    })

    test('a failed row delete keeps every row, shows the error on it and does not re-read', async () => {
      mockDeleteOrphanedFiles.mockRejectedValue(statusError(422))
      const orphans = await loaded()
      await orphans.deleteRow(orphans.orphanedFiles.rows[0]!)
      expect(orphans.totalCount.value).toBe(3)
      expect(orphans.orphanedFiles.rows[0]!.error).toBe('It could not be deleted (422).')
      expect(orphans.deleteOutcome.value).toBeUndefined()
      expect(mockFetchFileReport).toHaveBeenCalledTimes(1)
    })

    test('a failed delete all shows the error on the list', async () => {
      mockDeleteOrphanedFiles.mockRejectedValue(statusError(403))
      const orphans = await loaded()
      await orphans.deleteSection()
      expect(orphans.orphanedFiles.error).toBe('They could not be deleted (403).')
      expect(orphans.orphanedFiles.rows.every(row => !row.deleting)).toBe(true)
    })

    test('a failed delete everything shows the error', async () => {
      mockDeleteOrphanedFiles.mockRejectedValue(statusError())
      const orphans = await loaded()
      await orphans.deleteAll()
      expect(orphans.deleteError.value).toBe('The orphaned files could not be deleted (network error). Please try again.')
    })

    test('deleting a path marks every row with that path, since the API deletes it on each adapter', async () => {
      let resolveDelete!: (value: unknown) => void
      mockDeleteOrphanedFiles.mockReturnValue(new Promise((resolve) => {
        resolveDelete = resolve
      }))
      const orphans = await loaded()
      const deleting = orphans.deleteRow(orphans.orphanedFiles.rows[1]!)
      await flushPromises()
      expect(orphans.orphanedFiles.rows.map(row => row.deleting)).toEqual([false, true, true])
      resolveDelete(deletion())
      await deleting
    })

    test('a scan clears the delete outcome', async () => {
      const orphans = await loaded()
      await orphans.deleteAll()
      mockFetchFileReport.mockResolvedValue(report({ generatedAt: '2026-09-25T12:00:00+00:00' }))
      await orphans.scan()
      expect(orphans.deleteOutcome.value).toBeUndefined()
    })

    test('while deleting, another delete or a scan is refused', async () => {
      let resolveDelete!: (value: unknown) => void
      mockDeleteOrphanedFiles.mockReturnValue(new Promise((resolve) => {
        resolveDelete = resolve
      }))
      const orphans = await loaded()
      const deleting = orphans.deleteRow(orphans.orphanedFiles.rows[0]!)
      await flushPromises()
      expect(orphans.busy.value).toBe(true)
      await orphans.deleteRow(orphans.orphanedFiles.rows[1]!)
      await orphans.scan()
      expect(mockReveal).toHaveBeenCalledTimes(1)
      expect(mockRequestFileScan).not.toHaveBeenCalled()
      resolveDelete(deletion())
      await deleting
      expect(orphans.busy.value).toBe(false)
    })
  })
})
