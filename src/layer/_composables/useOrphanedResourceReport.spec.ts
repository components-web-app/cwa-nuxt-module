// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { useOrphanedResourceReport } from './useOrphanedResourceReport'
import * as cwaComposable from '#cwa/composables/cwa'

function report(overrides: Record<string, any> = {}) {
  return {
    generatedAt: '2026-09-25T10:00:00+00:00',
    components: ['/component/html_contents/c1', '/component/images/c2'],
    componentPositions: ['/_/component_positions/p1'],
    componentGroups: ['/_/component_groups/g1'],
    ...overrides,
  }
}

function statusError(statusCode?: number) {
  return Object.assign(new Error('failed'), { statusCode })
}

const mockFetchReport = vi.fn()
const mockRequestScan = vi.fn()
const onReport = vi.fn()

function setup() {
  // @ts-expect-error partial mock
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    orphanedResources: {
      fetchReport: mockFetchReport,
      requestScan: mockRequestScan,
    },
  }))
  return useOrphanedResourceReport({ onReport })
}

async function loaded() {
  const orphans = setup()
  await orphans.loadReport()
  return orphans
}

describe('useOrphanedResourceReport', () => {
  beforeEach(() => {
    mockFetchReport.mockReset().mockResolvedValue(report())
    mockRequestScan.mockReset().mockResolvedValue(undefined)
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

  describe('scanning', () => {
    test('requests a scan and keeps the new report when the scan ran synchronously', async () => {
      const orphans = await loaded()
      const newReport = report({ generatedAt: '2026-09-25T11:00:00+00:00', components: [] })
      mockFetchReport.mockResolvedValue(newReport)
      await orphans.scan()
      expect(mockRequestScan).toHaveBeenCalledTimes(1)
      expect(mockFetchReport).toHaveBeenCalledTimes(2)
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
