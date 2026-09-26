import { computed, reactive, ref } from 'vue'
import { createConfirmDialog } from 'vuejs-confirm-dialog'
import { consola as logger } from 'consola'
import { useCwa } from '#cwa/composables/cwa'
import ConfirmDialog from '#cwa/templates/components/core/ConfirmDialog.vue'
import { orphanedResourceEndpoint } from '#cwa/api/orphaned-resources'
import type { OrphanedResourceDeletionRequest, OrphanedResourceDeletionResult, OrphanedResourceKind, OrphanedResourceRejection } from '#cwa/api/orphaned-resources'
import { isNotFound, statusLabel, useOrphanedResourceReport } from './useOrphanedResourceReport'
import { CwaResourceTypes, getResourceTypeFromIri, ResourceTypeFromIri } from '#cwa/resources/resource-utils'

const REJECTION_REASONS: Record<OrphanedResourceRejection['reason'], string> = {
  not_orphaned: 'Kept: it is in use again, or it is a draft.',
  not_found: 'Already gone.',
}

export type OrphanedSectionKey = OrphanedResourceKind

export interface OrphanedRow {
  iri: string
  collection?: string
  deleting: boolean
  error?: string
  viewOpen: boolean
  viewLoading: boolean
  viewData?: unknown
  viewError?: string
}

export interface OrphanedSection {
  key: OrphanedSectionKey
  title: string
  singular: string
  plural: string
  rows: OrphanedRow[]
  error?: string
}

export interface OrphanedDeleteOutcome {
  summary: string
  rejected: { iri: string, reason: string }[]
}

function componentCollection(iri: string) {
  if (getResourceTypeFromIri(iri) !== CwaResourceTypes.COMPONENT) {
    return undefined
  }
  const prefix = ResourceTypeFromIri.getPathPrefix() || ''
  const path = iri.startsWith(prefix) ? iri.slice(prefix.length) : iri
  return path.split('/')[2]
}

function createRow(iri: string): OrphanedRow {
  return { iri, collection: componentCollection(iri), deleting: false, viewOpen: false, viewLoading: false }
}

async function confirm(title: string, content: string) {
  const dialog = createConfirmDialog(ConfirmDialog as Parameters<typeof createConfirmDialog>[0])
  const { isCanceled } = await dialog.reveal({ title, content })
  return !isCanceled
}

export function useOrphanedResources() {
  const $cwa = useCwa()

  const deleting = ref(false)
  const deleteOutcome = ref<OrphanedDeleteOutcome>()
  const deleteError = ref<string>()

  const sections = reactive<OrphanedSection[]>([
    { key: 'components', title: 'Components', singular: 'component', plural: 'components', rows: [] },
    { key: 'componentPositions', title: 'Component positions', singular: 'component position', plural: 'component positions', rows: [] },
    { key: 'componentGroups', title: 'Component groups', singular: 'component group', plural: 'component groups', rows: [] },
  ])

  const reportState = useOrphanedResourceReport({
    onReport(report) {
      for (const section of sections) {
        section.rows = (report[section.key] || []).map(createRow)
      }
    },
  })
  const { report, scanning } = reportState

  const hasReport = computed(() => report.value === undefined ? undefined : report.value !== null)
  const generatedAt = computed(() => report.value?.generatedAt)
  const totalCount = computed(() => sections.reduce((count, section) => count + section.rows.length, 0))
  const busy = computed(() => scanning.value || deleting.value)

  function scan() {
    if (busy.value) {
      return Promise.resolve()
    }
    deleteOutcome.value = undefined
    deleteError.value = undefined
    return reportState.scan()
  }

  async function fetchData(path: string) {
    const { response } = $cwa.fetch({ path, noQuery: true })
    const { _data: data } = await response
    return data
  }

  async function fetchViewData(iri: string) {
    const endpoint = orphanedResourceEndpoint(iri)
    try {
      return await fetchData(endpoint)
    }
    catch (error) {
      if (endpoint === iri || !isNotFound(error)) {
        throw error
      }
      return await fetchData(iri)
    }
  }

  async function toggleView(row: OrphanedRow) {
    row.viewOpen = !row.viewOpen
    if (!row.viewOpen || row.viewData !== undefined || row.viewLoading) {
      return
    }
    row.viewLoading = true
    row.viewError = undefined
    try {
      row.viewData = await fetchViewData(row.iri)
    }
    catch (error) {
      row.viewError = `The resource could not be loaded (${statusLabel(error)}).`
    }
    finally {
      row.viewLoading = false
    }
  }

  function countLabel(section: OrphanedSection, count: number) {
    return `${count} ${count === 1 ? section.singular : section.plural}`
  }

  function describeOutcome(result: OrphanedResourceDeletionResult): OrphanedDeleteOutcome {
    const parts = sections
      .map(section => ({ section, count: result.deleted?.[section.key]?.length || 0 }))
      .filter(({ count }) => count > 0)
      .map(({ section, count }) => countLabel(section, count))
    const listed = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0]
    return {
      summary: listed ? `Deleted ${listed}, including anything they contained.` : 'Nothing was deleted.',
      rejected: (result.rejected || []).map(({ iri, reason }) => ({ iri, reason: REJECTION_REASONS[reason] || 'Not deleted.' })),
    }
  }

  function removeLocally(result: OrphanedResourceDeletionResult) {
    const gone = new Set<string>([
      ...Object.values(result.deleted || {}).flat(),
      ...(result.rejected || []).filter(({ reason }) => reason === 'not_found').map(({ iri }) => iri),
    ])
    for (const section of sections) {
      section.rows = section.rows.filter(row => !gone.has(row.iri))
    }
  }

  async function showRemaining(result: OrphanedResourceDeletionResult) {
    try {
      if (await reportState.refreshReport()) {
        return
      }
    }
    catch (error) {
      logger.error('[CWA] Could not reload the orphaned resources report after deleting', error)
    }
    removeLocally(result)
  }

  async function deleteOrphans(request: OrphanedResourceDeletionRequest, rows: OrphanedRow[], onError: (label: string | number) => void) {
    deleteOutcome.value = undefined
    deleteError.value = undefined
    for (const section of sections) {
      section.error = undefined
      for (const row of section.rows) {
        row.error = undefined
      }
    }
    for (const row of rows) {
      row.deleting = true
    }
    let result: OrphanedResourceDeletionResult
    try {
      result = await $cwa.orphanedResources.deleteOrphans(request)
    }
    catch (error) {
      logger.error('[CWA] Could not delete orphaned resources', error)
      onError(statusLabel(error))
      return
    }
    finally {
      for (const row of rows) {
        row.deleting = false
      }
    }
    deleteOutcome.value = describeOutcome(result)
    await showRemaining(result)
  }

  async function whileDeleting(confirmed: () => Promise<boolean>, run: () => Promise<void>) {
    if (busy.value) {
      return
    }
    deleting.value = true
    try {
      if (!await confirmed()) {
        return
      }
      await run()
    }
    finally {
      deleting.value = false
    }
  }

  function deleteRow(row: OrphanedRow) {
    return whileDeleting(
      () => confirm('Delete this resource?', '<p>It will be checked again first, then permanently deleted along with anything it contains. This cannot be undone.</p>'),
      () => deleteOrphans({ iris: [row.iri] }, [row], (label) => {
        row.error = `It could not be deleted (${label}).`
      }),
    )
  }

  function deleteSection(section: OrphanedSection) {
    const rows = [...section.rows]
    if (!rows.length) {
      return Promise.resolve()
    }
    return whileDeleting(
      () => confirm(
        `Delete ${rows.length} orphaned ${rows.length === 1 ? section.singular : section.plural}?`,
        '<p>Each is checked again first, then permanently deleted along with anything it contains. This cannot be undone.</p>',
      ),
      () => deleteOrphans({ iris: rows.map(row => row.iri) }, rows, (label) => {
        section.error = `They could not be deleted (${label}).`
      }),
    )
  }

  function deleteAll() {
    if (!totalCount.value) {
      return Promise.resolve()
    }
    return whileDeleting(
      () => confirm(
        `Delete all ${totalCount.value} orphaned resources?`,
        '<p>Everything is checked again first. Whatever is still unused is permanently deleted along with anything it contains, including anything that has become unused since the last scan. This cannot be undone.</p>',
      ),
      () => deleteOrphans({ all: true }, sections.flatMap(section => section.rows), (label) => {
        deleteError.value = `The orphaned resources could not be deleted (${label}). Please try again.`
      }),
    )
  }

  return {
    loading: reportState.loading,
    hasReport,
    generatedAt,
    loadError: reportState.loadError,
    scanError: reportState.scanError,
    scanning,
    scanPending: reportState.scanPending,
    busy,
    deleteOutcome,
    deleteError,
    sections,
    totalCount,
    loadReport: reportState.loadReport,
    scan,
    toggleView,
    deleteRow,
    deleteSection,
    deleteAll,
  }
}
