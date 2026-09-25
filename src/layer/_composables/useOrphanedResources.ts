import { computed, reactive, ref } from 'vue'
import { createConfirmDialog } from 'vuejs-confirm-dialog'
import { consola as logger } from 'consola'
import { useCwa } from '#cwa/composables/cwa'
import ConfirmDialog from '#cwa/templates/components/core/ConfirmDialog.vue'
import { orphanedResourceEndpoint } from '#cwa/api/orphaned-resources'
import { isNotFound, statusLabel, useOrphanedResourceReport } from './useOrphanedResourceReport'
import { CwaResourceTypes, getResourceTypeFromIri, ResourceTypeFromIri } from '#cwa/resources/resource-utils'

const DELETE_CONCURRENCY = 4

export type OrphanedSectionKey = 'components' | 'componentPositions' | 'componentGroups'

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
    return reportState.scan()
  }

  async function toggleView(row: OrphanedRow) {
    row.viewOpen = !row.viewOpen
    if (!row.viewOpen || row.viewData !== undefined || row.viewLoading) {
      return
    }
    row.viewLoading = true
    row.viewError = undefined
    try {
      const { response } = $cwa.fetch({ path: orphanedResourceEndpoint(row.iri), noQuery: true })
      const { _data: data } = await response
      row.viewData = data
    }
    catch (error) {
      row.viewError = `The resource could not be loaded (${statusLabel(error)}).`
    }
    finally {
      row.viewLoading = false
    }
  }

  function removeRow(section: OrphanedSection, iri: string) {
    const index = section.rows.findIndex(row => row.iri === iri)
    if (index !== -1) {
      section.rows.splice(index, 1)
    }
  }

  async function deleteOne(section: OrphanedSection, row: OrphanedRow) {
    row.deleting = true
    row.error = undefined
    try {
      await $cwa.orphanedResources.deleteResource(row.iri)
      removeRow(section, row.iri)
    }
    catch (error) {
      if (isNotFound(error)) {
        removeRow(section, row.iri)
        return
      }
      row.error = `It could not be deleted (${statusLabel(error)}).`
      logger.error(`[CWA] Could not delete the orphaned resource ${row.iri}`, error)
    }
    finally {
      row.deleting = false
    }
  }

  async function deleteRows(section: OrphanedSection) {
    const queue = [...section.rows]
    const worker = async () => {
      let row = queue.shift()
      while (row) {
        await deleteOne(section, row)
        row = queue.shift()
      }
    }
    await Promise.all(Array.from({ length: Math.min(DELETE_CONCURRENCY, queue.length) }, worker))
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

  function deleteRow(section: OrphanedSection, row: OrphanedRow) {
    return whileDeleting(
      () => confirm('Delete this resource?', '<p>It will be permanently deleted, along with anything it contains. This cannot be undone.</p>'),
      () => deleteOne(section, row),
    )
  }

  function deleteSection(section: OrphanedSection) {
    const count = section.rows.length
    return whileDeleting(
      () => confirm(
        `Delete ${count} orphaned ${count === 1 ? section.singular : section.plural}?`,
        '<p>They will be permanently deleted, along with anything they contain. This cannot be undone.</p>',
      ),
      () => deleteRows(section),
    )
  }

  function deleteAll() {
    return whileDeleting(
      () => confirm(
        `Delete all ${totalCount.value} orphaned resources?`,
        '<p>Components are deleted first, then component positions, then component groups. Deleting a group also deletes the positions inside it. This cannot be undone.</p>',
      ),
      async () => {
        for (const section of sections) {
          await deleteRows(section)
        }
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
