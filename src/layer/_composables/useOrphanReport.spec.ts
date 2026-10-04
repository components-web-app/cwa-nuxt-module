// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { useOrphanedFileReport, useOrphanedResourceReport } from './useOrphanReport'
import * as cwaComposable from '#cwa/composables/cwa'

function resourceReport(overrides: Record<string, any> = {}) {
  return {
    generatedAt: '2026-09-25T10:00:00+00:00',
    components: ['/component/html_contents/c1', '/component/images/c2'],
    componentPositions: ['/_/component_positions/p1'],
    componentGroups: ['/_/component_groups/g1'],
    ...overrides,
  }
}

function fileReport(overrides: Record<string, any> = {}) {
  return {
    generatedAt: '2026-09-25T10:00:00+00:00',
    orphanedFiles: [
      { adapter: 'local', path: 'files/a.png' },
      { adapter: 'local', path: 'files/b.png' },
      { adapter: 's3', path: 'files/b.png' },
      { adapter: 's3', path: 'files/c.pdf' },
    ],
    missingFiles: [{ resource: '/component/images/i1', adapter: 'local', path: 'files/gone.png' }],
    ...overrides,
  }
}

function statusError(statusCode?: number) {
  return Object.assign(new Error('failed'), { statusCode })
}

const mockFetchReport = vi.fn()
const mockRequestScan = vi.fn()
const mockOtherFetch = vi.fn()
const mockOtherScan = vi.fn()
const onReport = vi.fn()

const cases = [
  {
    name: 'useOrphanedResourceReport',
    methods: ['fetchReport', 'requestScan'],
    others: ['fetchFileReport', 'requestFileScan'],
    use: useOrphanedResourceReport,
    report: resourceReport,
    emptied: { components: [] },
  },
  {
    name: 'useOrphanedFileReport',
    methods: ['fetchFileReport', 'requestFileScan'],
    others: ['fetchReport', 'requestScan'],
    use: useOrphanedFileReport,
    report: fileReport,
    emptied: { orphanedFiles: [] },
  },
] as const

describe.each(cases)('$name', ({ methods, others, use, report: reportOf, emptied }) => {
  const report = (overrides: Record<string, any> = {}) => reportOf(overrides)

  function setup() {
    // @ts-expect-error partial mock
    vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
      orphanedResources: {
        [methods[0]]: mockFetchReport,
        [methods[1]]: mockRequestScan,
        [others[0]]: mockOtherFetch,
        [others[1]]: mockOtherScan,
      },
    }))
    return use({ onReport } as any)
  }

  async function loaded() {
    const orphans = setup()
    await orphans.loadReport()
    return orphans
  }

  beforeEach(() => {
    mockFetchReport.mockReset().mockResolvedValue(report())
    mockRequestScan.mockReset().mockResolvedValue(undefined)
    mockOtherFetch.mockReset()
    mockOtherScan.mockReset()
    onReport.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('loading the report', () => {
    test('a 404 means no scan has stored a report yet, which is not an error', async () => {
      mockFetchReport.mockRejectedValue(statusError(404))
      const orphans = await loaded()
      expect(orphans.report.value).toBeNull()
      expect(orphans.loadError.value).toBeUndefined()
      expect(orphans.loading.value).toBe(false)
      expect(onReport).not.toHaveBeenCalled()
    })

    test('a stored report is kept, counted and handed on', async () => {
      const orphans = await loaded()
      expect(orphans.report.value).toEqual(report())
      expect(orphans.orphanCount.value).toBe(4)
      expect(mockOtherFetch).not.toHaveBeenCalled()
      expect(onReport).toHaveBeenCalledWith(report())
    })

    test('any other failure is reported with its status, and is not mistaken for no scan', async () => {
      mockFetchReport.mockRejectedValue(statusError(500))
      const orphans = await loaded()
      expect(orphans.loadError.value).toBe('The report could not be loaded (500). Please try again.')
      expect(orphans.report.value).toBeUndefined()
      expect(orphans.orphanCount.value).toBe(0)
    })

    test('a failure with no status is reported as a network error', async () => {
      mockFetchReport.mockRejectedValue(statusError())
      const orphans = await loaded()
      expect(orphans.loadError.value).toBe('The report could not be loaded (network error). Please try again.')
    })
  })

  describe('refreshing the report', () => {
    test('keeps and hands on the refreshed report without showing the loading state', async () => {
      const orphans = await loaded()
      const refreshed = report({ generatedAt: '2026-09-25T11:00:00+00:00', ...emptied })
      mockFetchReport.mockResolvedValue(refreshed)
      const refreshing = orphans.refreshReport()
      expect(orphans.loading.value).toBe(false)
      await expect(refreshing).resolves.toBe(true)
      expect(orphans.report.value).toEqual(refreshed)
      expect(onReport).toHaveBeenLastCalledWith(refreshed)
    })

    test('a 404 keeps the current report and says it was not refreshed', async () => {
      const orphans = await loaded()
      mockFetchReport.mockRejectedValue(statusError(404))
      await expect(orphans.refreshReport()).resolves.toBe(false)
      expect(orphans.report.value).toEqual(report())
      expect(onReport).toHaveBeenCalledTimes(1)
    })

    test('a failure rejects, keeps the current report and sets no load error', async () => {
      const orphans = await loaded()
      const error = statusError(500)
      mockFetchReport.mockRejectedValue(error)
      await expect(orphans.refreshReport()).rejects.toBe(error)
      expect(orphans.report.value).toEqual(report())
      expect(orphans.loadError.value).toBeUndefined()
    })
  })

  describe('scanning', () => {
    test('requests a scan and keeps the new report when the scan ran synchronously', async () => {
      const orphans = await loaded()
      const newReport = report({ generatedAt: '2026-09-25T11:00:00+00:00', ...emptied })
      mockFetchReport.mockResolvedValue(newReport)
      await orphans.scan()
      expect(mockRequestScan).toHaveBeenCalledTimes(1)
      expect(mockFetchReport).toHaveBeenCalledTimes(2)
      expect(mockOtherScan).not.toHaveBeenCalled()
      expect(mockOtherFetch).not.toHaveBeenCalled()
      expect(orphans.report.value).toEqual(newReport)
      expect(onReport).toHaveBeenLastCalledWith(newReport)
      expect(orphans.scanPending.value).toBe(false)
      expect(orphans.scanning.value).toBe(false)
    })

    test('the first scan replaces the no-scan state', async () => {
      mockFetchReport.mockRejectedValueOnce(statusError(404))
      const orphans = await loaded()
      await orphans.scan()
      expect(orphans.report.value).toEqual(report())
    })

    test('a scan clears an earlier load error', async () => {
      mockFetchReport.mockRejectedValueOnce(statusError(500))
      const orphans = await loaded()
      await orphans.scan()
      expect(orphans.loadError.value).toBeUndefined()
    })

    test('polls while an asynchronous scan has not stored a new report, and keeps it once it has', async () => {
      vi.useFakeTimers()
      const orphans = await loaded()
      mockFetchReport.mockReset()
        .mockResolvedValueOnce(report())
        .mockResolvedValueOnce(report())
        .mockResolvedValue(report({ generatedAt: '2026-09-25T11:00:00+00:00' }))
      const scanning = orphans.scan()
      await flushPromises()
      expect(mockFetchReport).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(2000)
      expect(mockFetchReport).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(2000)
      await scanning
      expect(mockFetchReport).toHaveBeenCalledTimes(3)
      expect(orphans.report.value?.generatedAt).toBe('2026-09-25T11:00:00+00:00')
      expect(orphans.scanPending.value).toBe(false)
    })

    test('a scan still running after the polling bound stops polling and says it was requested', async () => {
      vi.useFakeTimers()
      const orphans = await loaded()
      mockFetchReport.mockClear()
      const scanning = orphans.scan()
      await vi.advanceTimersByTimeAsync(60_000)
      await scanning
      expect(mockFetchReport).toHaveBeenCalledTimes(6)
      expect(orphans.scanPending.value).toBe(true)
      expect(orphans.scanning.value).toBe(false)
      expect(orphans.report.value?.generatedAt).toBe('2026-09-25T10:00:00+00:00')
    })

    test('the polling bound is about ten seconds', async () => {
      vi.useFakeTimers()
      const orphans = await loaded()
      const scanning = orphans.scan()
      await vi.advanceTimersByTimeAsync(9_999)
      expect(orphans.scanning.value).toBe(true)
      await vi.advanceTimersByTimeAsync(1)
      await scanning
      expect(orphans.scanning.value).toBe(false)
      expect(orphans.scanPending.value).toBe(true)
    })

    test('a 404 while polling means the first report has not been stored yet', async () => {
      vi.useFakeTimers()
      mockFetchReport.mockRejectedValueOnce(statusError(404))
      const orphans = await loaded()
      mockFetchReport.mockReset()
        .mockRejectedValueOnce(statusError(404))
        .mockResolvedValue(report())
      const scanning = orphans.scan()
      await vi.advanceTimersByTimeAsync(2000)
      await scanning
      expect(orphans.report.value).toEqual(report())
      expect(orphans.scanError.value).toBeUndefined()
    })

    test('a scan already running is not requested again', async () => {
      let resolveScan!: () => void
      mockRequestScan.mockReturnValue(new Promise<void>((resolve) => {
        resolveScan = resolve
      }))
      const orphans = await loaded()
      const first = orphans.scan()
      await orphans.scan()
      expect(mockRequestScan).toHaveBeenCalledTimes(1)
      mockFetchReport.mockResolvedValue(report({ generatedAt: '2026-09-25T11:00:00+00:00' }))
      resolveScan()
      await first
    })

    test('a failed scan request is reported as a scan error and the report is not refetched', async () => {
      const orphans = await loaded()
      mockFetchReport.mockClear()
      mockRequestScan.mockRejectedValue(statusError(403))
      await orphans.scan()
      expect(mockFetchReport).not.toHaveBeenCalled()
      expect(orphans.scanError.value).toBe('The scan could not be requested (403). Please try again.')
      expect(orphans.loadError.value).toBeUndefined()
      expect(orphans.report.value).toEqual(report())
    })

    test('a failed refetch keeps the report, stops polling and is reported as a scan error', async () => {
      vi.useFakeTimers()
      const orphans = await loaded()
      mockFetchReport.mockReset().mockRejectedValue(statusError(502))
      const scanning = orphans.scan()
      await vi.advanceTimersByTimeAsync(60_000)
      await scanning
      expect(mockFetchReport).toHaveBeenCalledTimes(1)
      expect(orphans.scanError.value).toBe('The report could not be loaded (502). Please try again.')
      expect(orphans.report.value).toEqual(report())
      expect(orphans.scanPending.value).toBe(false)
    })

    test('a new scan clears the previous scan error', async () => {
      const orphans = await loaded()
      mockRequestScan.mockRejectedValueOnce(statusError(403))
      await orphans.scan()
      mockFetchReport.mockResolvedValue(report({ generatedAt: '2026-09-25T11:00:00+00:00' }))
      await orphans.scan()
      expect(orphans.scanError.value).toBeUndefined()
    })
  })
})

describe('useOrphanedFileReport counts', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function loadedWith(report: Record<string, any> | Error) {
    const fetchFileReport = report instanceof Error ? vi.fn().mockRejectedValue(report) : vi.fn().mockResolvedValue(report)
    // @ts-expect-error partial mock
    vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
      orphanedResources: { fetchFileReport, requestFileScan: vi.fn() },
    }))
    const files = useOrphanedFileReport()
    await files.loadReport()
    return files
  }

  test('missing files are counted apart from orphaned files, since they are not orphans', async () => {
    const files = await loadedWith(fileReport({
      orphanedFiles: [],
      missingFiles: [
        { resource: '/component/images/i1', adapter: 'local', path: 'files/gone.png' },
        { resource: '/component/images/i2', adapter: 'local', path: 'files/gone-too.png' },
      ],
    }))
    expect(files.orphanCount.value).toBe(0)
    expect(files.missingCount.value).toBe(2)
  })

  test('no report counts nothing missing', async () => {
    const files = await loadedWith(statusError(404))
    expect(files.missingCount.value).toBe(0)
  })
})
