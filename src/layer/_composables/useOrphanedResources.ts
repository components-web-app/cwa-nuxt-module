import { computed, reactive } from 'vue'
import type { OrphanedResourceDeletionRequest, OrphanedResourceDeletionResult, OrphanedResourceKind, OrphanedResourceRejection } from '#cwa/api/orphaned-resources'
import { useCwa } from '#cwa/composables/cwa'
import { useOrphanedResourceReport } from './useOrphanReport'
import { useOrphanDeletion, useOrphanView } from './useOrphanActions'
import type { DeletableRow, OrphanDeleteOutcome, ViewableRow } from './useOrphanActions'
import { CwaResourceTypes, getResourceTypeFromIri, ResourceTypeFromIri } from '#cwa/resources/resource-utils'

const REJECTION_REASONS: Record<OrphanedResourceRejection['reason'], string> = {
  not_orphaned: 'Kept: it is in use again, or it is a draft.',
  not_found: 'Already gone.',
}

export type OrphanedSectionKey = OrphanedResourceKind

export interface OrphanedRow extends DeletableRow, ViewableRow {
  collection?: string
}

export interface OrphanedSection {
  key: OrphanedSectionKey
  title: string
  singular: string
  plural: string
  rows: OrphanedRow[]
  error?: string
}

export type OrphanedDeleteOutcome = OrphanDeleteOutcome<{ iri: string, reason: string }>

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

export function useOrphanedResources() {
  const $cwa = useCwa()

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

  const deletion = useOrphanDeletion<OrphanedResourceDeletionRequest, OrphanedResourceDeletionResult, { iri: string, reason: string }>({
    name: 'orphaned resources',
    scanning,
    send: request => $cwa.orphanedResources.deleteOrphans(request),
    describe: describeOutcome,
    refreshReport: reportState.refreshReport,
    removeLocally,
    clearErrors() {
      for (const section of sections) {
        section.error = undefined
        for (const row of section.rows) {
          row.error = undefined
        }
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

  function deleteRow(row: OrphanedRow) {
    return deletion.run(
      ['Delete this resource?', '<p>It will be checked again first, then permanently deleted along with anything it contains. This cannot be undone.</p>'],
      { iris: [row.iri] },
      [row],
      (label) => {
        row.error = `It could not be deleted (${label}).`
      },
    )
  }

  function deleteSection(section: OrphanedSection) {
    const rows = [...section.rows]
    if (!rows.length) {
      return Promise.resolve()
    }
    return deletion.run(
      [
        `Delete ${rows.length} orphaned ${rows.length === 1 ? section.singular : section.plural}?`,
        '<p>Each is checked again first, then permanently deleted along with anything it contains. This cannot be undone.</p>',
      ],
      { iris: rows.map(row => row.iri) },
      rows,
      (label) => {
        section.error = `They could not be deleted (${label}).`
      },
    )
  }

  function deleteAll() {
    if (!totalCount.value) {
      return Promise.resolve()
    }
    return deletion.run(
      [
        `Delete all ${totalCount.value} orphaned resources?`,
        '<p>Everything is checked again first. Whatever is still unused is permanently deleted along with anything it contains, including anything that has become unused since the last scan. This cannot be undone.</p>',
      ],
      { all: true },
      sections.flatMap(section => section.rows),
      (label) => {
        deleteError.value = `The orphaned resources could not be deleted (${label}). Please try again.`
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
    sections,
    totalCount,
    loadReport: reportState.loadReport,
    scan,
    toggleView: useOrphanView().toggleView,
    deleteRow,
    deleteSection,
    deleteAll,
  }
}
