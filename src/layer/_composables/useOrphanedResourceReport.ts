import { computed, ref } from 'vue'
import { consola as logger } from 'consola'
import { useCwa } from '#cwa/composables/cwa'
import type { OrphanedResourceReport } from '#cwa/api/orphaned-resources'

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

function reportLoadFailure(error: unknown) {
  logger.error('[CWA] Could not load the orphaned resources report', error)
  return `The report could not be loaded (${statusLabel(error)}). Please try again.`
}

export function useOrphanedResourceReport(ops: { onReport?: (report: OrphanedResourceReport) => void } = {}) {
  const $cwa = useCwa()

  const loading = ref(true)
  const report = ref<OrphanedResourceReport | null>()
  const loadError = ref<string>()
  const scanError = ref<string>()
  const scanning = ref(false)
  const scanPending = ref(false)

  const orphanCount = computed(() => {
    const current = report.value
    if (!current) {
      return 0
    }
    return (current.components?.length || 0) + (current.componentPositions?.length || 0) + (current.componentGroups?.length || 0)
  })

  function applyReport(newReport: OrphanedResourceReport) {
    report.value = newReport
    ops.onReport?.(newReport)
  }

  async function fetchReport(): Promise<OrphanedResourceReport | null> {
    try {
      return await $cwa.orphanedResources.fetchReport()
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
        await $cwa.orphanedResources.requestScan()
      }
      catch (error) {
        scanError.value = `The scan could not be requested (${statusLabel(error)}). Please try again.`
        logger.error('[CWA] Could not request an orphaned resources scan', error)
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
    scan,
  }
}
