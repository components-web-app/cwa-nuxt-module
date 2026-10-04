import { computed, ref } from 'vue'
import type { Ref } from 'vue'
import { consola as logger } from 'consola'
import { useCwa } from '#cwa/composables/cwa'
import type { OrphanedFileReport, OrphanedResourceReport } from '#cwa/api/orphaned-resources'

const SCAN_POLL_ATTEMPTS = 5
const SCAN_POLL_INTERVAL = 2000

export function statusLabel(error: unknown) {
  return (error as { statusCode?: number } | undefined)?.statusCode || 'network error'
}

export function isNotFound(error: unknown) {
  return (error as { statusCode?: number } | undefined)?.statusCode === 404
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface OrphanReportSource<T extends { generatedAt: string }> {
  name: string
  fetchReport: () => Promise<T>
  requestScan: () => Promise<void>
  count: (report: T) => number
}

export interface OrphanReportOptions<T> {
  onReport?: (report: T) => void
}

function useOrphanReport<T extends { generatedAt: string }>(source: OrphanReportSource<T>, ops: OrphanReportOptions<T>) {
  const loading = ref(true)
  const report = ref<T | null>() as Ref<T | null | undefined>
  const loadError = ref<string>()
  const scanError = ref<string>()
  const scanning = ref(false)
  const scanPending = ref(false)

  const orphanCount = computed(() => report.value ? source.count(report.value) : 0)

  function reportLoadFailure(error: unknown) {
    logger.error(`[CWA] Could not load the ${source.name} report`, error)
    return `The report could not be loaded (${statusLabel(error)}). Please try again.`
  }

  function applyReport(newReport: T) {
    report.value = newReport
    ops.onReport?.(newReport)
  }

  async function fetchReport(): Promise<T | null> {
    try {
      return await source.fetchReport()
    }
    catch (error) {
      if (isNotFound(error)) {
        return null
      }
      throw error
    }
  }

  async function loadReport() {
    loading.value = true
    loadError.value = undefined
    try {
      const fetched = await fetchReport()
      if (fetched) {
        applyReport(fetched)
      }
      else {
        report.value = null
      }
    }
    catch (error) {
      loadError.value = reportLoadFailure(error)
    }
    finally {
      loading.value = false
    }
  }

  async function refreshReport() {
    const fetched = await fetchReport()
    if (!fetched) {
      return false
    }
    applyReport(fetched)
    return true
  }

  async function pollForNewReport(previous: string | undefined) {
    for (let attempt = 0; attempt <= SCAN_POLL_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        await wait(SCAN_POLL_INTERVAL)
      }
      const fetched = await fetchReport()
      if (fetched && fetched.generatedAt !== previous) {
        applyReport(fetched)
        return true
      }
    }
    return false
  }

  async function scan() {
    if (scanning.value) {
      return
    }
    scanning.value = true
    scanPending.value = false
    scanError.value = undefined
    loadError.value = undefined
    try {
      try {
        await source.requestScan()
      }
      catch (error) {
        scanError.value = `The scan could not be requested (${statusLabel(error)}). Please try again.`
        logger.error(`[CWA] Could not request an ${source.name} scan`, error)
        return
      }
      try {
        scanPending.value = !await pollForNewReport(report.value?.generatedAt)
      }
      catch (error) {
        scanError.value = reportLoadFailure(error)
      }
    }
    finally {
      scanning.value = false
    }
  }

  return {
    loading,
    report,
    orphanCount,
    loadError,
    scanError,
    scanning,
    scanPending,
    loadReport,
    refreshReport,
    scan,
  }
}

export function useOrphanedResourceReport(ops: OrphanReportOptions<OrphanedResourceReport> = {}) {
  const $cwa = useCwa()
  return useOrphanReport<OrphanedResourceReport>({
    name: 'orphaned resources',
    fetchReport: () => $cwa.orphanedResources.fetchReport(),
    requestScan: () => $cwa.orphanedResources.requestScan(),
    count: report => (report.components?.length || 0) + (report.componentPositions?.length || 0) + (report.componentGroups?.length || 0),
  }, ops)
}

export function useOrphanedFileReport(ops: OrphanReportOptions<OrphanedFileReport> = {}) {
  const $cwa = useCwa()
  const state = useOrphanReport<OrphanedFileReport>({
    name: 'orphaned files',
    fetchReport: () => $cwa.orphanedResources.fetchFileReport(),
    requestScan: () => $cwa.orphanedResources.requestFileScan(),
    count: report => report.orphanedFiles?.length || 0,
  }, ops)
  const missingCount = computed(() => state.report.value?.missingFiles?.length || 0)
  return { ...state, missingCount }
}
