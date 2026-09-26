import { computed, reactive } from 'vue'
import type { MissingFile, OrphanedFile, OrphanedFileDeletionRequest, OrphanedFileDeletionResult, OrphanedFileRejection } from '#cwa/api/orphaned-resources'
import { useCwa } from '#cwa/composables/cwa'
import { useOrphanedFileReport } from './useOrphanReport'
import { useOrphanDeletion, useOrphanView } from './useOrphanActions'
import type { DeletableRow, OrphanDeleteOutcome, ViewableRow } from './useOrphanActions'

const REJECTION_REASONS: Record<OrphanedFileRejection['reason'], string> = {
  not_orphaned: 'Kept: something references it again.',
  not_found: 'Already gone.',
  delete_failed: 'Could not be deleted from storage.',
}

export interface OrphanedFileRow extends DeletableRow, OrphanedFile {
  key: string
}

export interface MissingFileRow extends ViewableRow, OrphanedFile {
  key: string
}

export type OrphanedFileDeleteOutcome = OrphanDeleteOutcome<{ path: string, reason: string }>

function fileKey({ adapter, path }: OrphanedFile) {
  return JSON.stringify([adapter, path])
}

function createOrphanedRow(file: OrphanedFile): OrphanedFileRow {
  return { key: fileKey(file), adapter: file.adapter, path: file.path, deleting: false }
}

function createMissingRow(file: MissingFile): MissingFileRow {
  return { key: JSON.stringify([file.resource, file.adapter, file.path]), iri: file.resource, adapter: file.adapter, path: file.path, viewOpen: false, viewLoading: false }
}

function filesLabel(count: number) {
  return `${count} ${count === 1 ? 'file' : 'files'}`
}

export function useOrphanedFiles() {
  const $cwa = useCwa()

  const orphanedFiles = reactive<{ rows: OrphanedFileRow[], error?: string }>({ rows: [] })
  const missingFiles = reactive<{ rows: MissingFileRow[] }>({ rows: [] })

  const reportState = useOrphanedFileReport({
    onReport(report) {
      orphanedFiles.rows = (report.orphanedFiles || []).map(createOrphanedRow)
      missingFiles.rows = (report.missingFiles || []).map(createMissingRow)
    },
  })
  const { report, scanning } = reportState

  const hasReport = computed(() => report.value === undefined ? undefined : report.value !== null)
  const generatedAt = computed(() => report.value?.generatedAt)
  const totalCount = computed(() => orphanedFiles.rows.length)

  function describeOutcome(result: OrphanedFileDeletionResult): OrphanedFileDeleteOutcome {
    const count = result.deleted?.length || 0
    return {
      summary: count ? `Deleted ${filesLabel(count)}.` : 'Nothing was deleted.',
      rejected: (result.rejected || []).map(({ path, reason }) => ({ path, reason: REJECTION_REASONS[reason] || 'Not deleted.' })),
    }
  }

  function removeLocally(result: OrphanedFileDeletionResult) {
    const deleted = new Set((result.deleted || []).map(fileKey))
    const gone = new Set((result.rejected || []).filter(({ reason }) => reason === 'not_found').map(({ path }) => path))
    orphanedFiles.rows = orphanedFiles.rows.filter(row => !deleted.has(row.key) && !gone.has(row.path))
  }

  const deletion = useOrphanDeletion<OrphanedFileDeletionRequest, OrphanedFileDeletionResult, { path: string, reason: string }>({
    name: 'orphaned files',
    scanning,
    send: request => $cwa.orphanedResources.deleteOrphanedFiles(request),
    describe: describeOutcome,
    refreshReport: reportState.refreshReport,
    removeLocally,
    clearErrors() {
      orphanedFiles.error = undefined
      for (const row of orphanedFiles.rows) {
        row.error = undefined
      }
    },
  })
  const { busy, deleteError } = deletion

  function scan() {
    if (busy.value) {
      return Promise.resolve()
    }
    deletion.clearOutcome()
    return reportState.scan()
  }

  function deleteRow(row: OrphanedFileRow) {
    return deletion.run(
      ['Delete this file?', '<p>It will be checked again first, then permanently deleted from storage, from every adapter where it is orphaned. This cannot be undone.</p>'],
      { paths: [row.path] },
      orphanedFiles.rows.filter(({ path }) => path === row.path),
      (label) => {
        row.error = `It could not be deleted (${label}).`
      },
    )
  }

  function deleteSection() {
    const rows = [...orphanedFiles.rows]
    if (!rows.length) {
      return Promise.resolve()
    }
    return deletion.run(
      [
        `Delete ${rows.length} orphaned ${rows.length === 1 ? 'file' : 'files'}?`,
        '<p>Each is checked again first, then permanently deleted from storage. This cannot be undone.</p>',
      ],
      { paths: rows.map(row => row.path) },
      rows,
      (label) => {
        orphanedFiles.error = `They could not be deleted (${label}).`
      },
    )
  }

  function deleteAll() {
    if (!totalCount.value) {
      return Promise.resolve()
    }
    return deletion.run(
      [
        `Delete all ${totalCount.value} orphaned files?`,
        '<p>Everything is checked again first. Whatever is still unused is permanently deleted from storage, including anything that has become unused since the last scan. Missing files are never deleted. This cannot be undone.</p>',
      ],
      { all: true },
      [...orphanedFiles.rows],
      (label) => {
        deleteError.value = `The orphaned files could not be deleted (${label}). Please try again.`
      },
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
    deleteOutcome: deletion.deleteOutcome,
    deleteError,
    orphanedFiles,
    missingFiles,
    totalCount,
    loadReport: reportState.loadReport,
    scan,
    toggleView: useOrphanView().toggleView,
    deleteRow,
    deleteSection,
    deleteAll,
  }
}
