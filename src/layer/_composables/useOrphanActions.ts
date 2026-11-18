import { computed, ref } from 'vue'
import type { Ref } from 'vue'
import { consola as logger } from 'consola'
import { useCwa } from '#cwa/composables/cwa'
import { useCwaConfirm } from '#cwa/composables/cwa-confirm'
import type { CwaConfirmOptions } from '#cwa/composables/cwa-confirm'
import { orphanedResourceEndpoint } from '#cwa/api/orphaned-resources'
import { isNotFound, statusLabel } from './useOrphanReport'

export interface DeletableRow {
  deleting: boolean
  error?: string
}

export interface ViewableRow {
  iri: string
  viewOpen: boolean
  viewLoading: boolean
  viewData?: unknown
  viewError?: string
}

export interface OrphanDeleteOutcome<TRejected> {
  summary: string
  rejected: TRejected[]
}

export function deletionConfirm({ title, lines, go, typed }: { title: string, lines: string[], go: string, typed?: CwaConfirmOptions['typed'] }): CwaConfirmOptions {
  return {
    title,
    lines: [...lines.map(text => ({ text })), { text: 'This can\'t be undone.' }],
    keep: 'Don\'t delete',
    go,
    typed,
  }
}

export function useOrphanView() {
  const $cwa = useCwa()

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

  async function toggleView(row: ViewableRow) {
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

  return { toggleView }
}

interface OrphanDeletionSource<TRequest, TResult, TRejected> {
  name: string
  scanning: Ref<boolean>
  send: (request: TRequest) => Promise<TResult>
  describe: (result: TResult) => OrphanDeleteOutcome<TRejected>
  refreshReport: () => Promise<boolean>
  removeLocally: (result: TResult) => void
  clearErrors: () => void
}

export function useOrphanDeletion<TRequest, TResult, TRejected>(source: OrphanDeletionSource<TRequest, TResult, TRejected>) {
  const confirm = useCwaConfirm()
  const deleting = ref(false)
  const deleteOutcome = ref<OrphanDeleteOutcome<TRejected>>() as Ref<OrphanDeleteOutcome<TRejected> | undefined>
  const deleteError = ref<string>()
  const busy = computed(() => source.scanning.value || deleting.value)

  function clearOutcome() {
    deleteOutcome.value = undefined
    deleteError.value = undefined
  }

  async function showRemaining(result: TResult) {
    try {
      if (await source.refreshReport()) {
        return
      }
    }
    catch (error) {
      logger.error(`[CWA] Could not reload the ${source.name} report after deleting`, error)
    }
    source.removeLocally(result)
  }

  async function send(request: TRequest, rows: DeletableRow[], onError: (label: string | number) => void) {
    clearOutcome()
    source.clearErrors()
    for (const row of rows) {
      row.deleting = true
    }
    let result: TResult
    try {
      result = await source.send(request)
    }
    catch (error) {
      logger.error(`[CWA] Could not delete ${source.name}`, error)
      onError(statusLabel(error))
      return
    }
    finally {
      for (const row of rows) {
        row.deleting = false
      }
    }
    deleteOutcome.value = source.describe(result)
    await showRemaining(result)
  }

  async function run(confirmation: CwaConfirmOptions, request: TRequest, rows: DeletableRow[], onError: (label: string | number) => void) {
    if (busy.value) {
      return
    }
    deleting.value = true
    try {
      if (!await confirm(confirmation)) {
        return
      }
      await send(request, rows, onError)
    }
    finally {
      deleting.value = false
    }
  }

  return { busy, deleteOutcome, deleteError, clearOutcome, run }
}
