import { computed, ref } from 'vue'
import type { ComputedRef } from 'vue'
import { useCwaResourceEndpoint } from '#cwa/composables/cwa-resource-endpoint'
import { useCwa } from '#cwa/composables/cwa'
import { useNuxtApp } from '#imports'
import { writeFieldStates } from '#cwa/resources/field-state-writer'
import type { CwaFieldState } from '#cwa/storage/stores/resources/state'
import { fieldStateReporter, heldUpload, holdUpload, releaseUpload, sendHeldUpload, sendUpload } from '#cwa/admin/held-uploads'
import { createBrowserImageDownscaleDeps, downscaleImageFile, resolveImageDownscaleOptions } from '#cwa/files/image-downscale'
import type { ImageDownscaleOptions } from '#cwa/files/image-downscale'

export interface CwaResourceUploadOps {
  imageDownscale?: Partial<ImageDownscaleOptions>
}

export const useCwaResourceUpload = (iri: ComputedRef<string | undefined>, filename: string = 'file', fileDisplayType: string = 'File', ops?: CwaResourceUploadOps) => {
  const $cwa = useCwa()
  const vueApp = useNuxtApp().vueApp
  const resource = computed(() => iri.value ? $cwa.resources.getResource(iri.value).value : undefined)

  const fileData = computed(() => resource.value?.data?._metadata.mediaObjects?.[filename]?.[0])

  const updating = ref(false)

  const IDLE: CwaFieldState = { status: 'idle', waiting: false, slow: false }
  const state = computed<CwaFieldState>(() => resource.value?.fieldStates?.[filename] ?? IDLE)
  let lastSend: (() => Promise<void>) | undefined

  async function send(run: () => Promise<unknown>) {
    updating.value = true
    try {
      await run()
    }
    finally {
      updating.value = false
    }
  }

  const held = computed(() => iri.value ? heldUpload($cwa, iri.value, filename) : undefined)
  const persisted = computed(() => resource.value?.data?._metadata?.persisted !== false)

  function retry() {
    if (lastSend) {
      return lastSend()
    }
    const heldIri = iri.value
    if (held.value && heldIri) {
      return send(() => sendHeldUpload($cwa, heldIri, filename, updateEndpoint.value))
    }
    const entry = resource.value
    entry && writeFieldStates(states => states.retryWrite(entry, filename))
    return Promise.resolve()
  }

  async function reset() {
    lastSend = undefined
    const entry = resource.value
    entry && writeFieldStates(states => states.cleared(entry, filename))
  }

  const file = computed(() => {
    if (fileData.value) {
      return {
        name: decodeURIComponent(fileData.value.contentUrl?.split('?')[0]?.split('/').pop() || fileDisplayType),
        size: fileData.value.formattedFileSize as string,
        url: fileData.value.contentUrl as string | undefined,
        mimeType: fileData.value.mimeType as string | undefined,
      }
    }
    const holding = held.value
    return holding ? { name: holding.file.name, size: formatFileSize(holding.file.size), url: holding.url, mimeType: holding.file.type || undefined } : undefined
  })

  const fileExists = computed(() => !!fileData.value || !!held.value)

  const { endpoint: updateEndpoint } = useCwaResourceEndpoint(iri, '/upload')
  const { endpoint: deleteEndpoint } = useCwaResourceEndpoint(iri)

  async function handleInputChangeFile(newFile: File | undefined) {
    if (!newFile || !iri.value) {
      return
    }
    updating.value = true
    const uploadFile = await downscaleImageFile(
      newFile,
      resolveImageDownscaleOptions($cwa.uploadConfig?.image, ops?.imageDownscale),
      createBrowserImageDownscaleDeps(),
    )
    const uploadIri = iri.value
    if (!persisted.value) {
      holdUpload($cwa, uploadIri, filename, uploadFile)
      const entry = resource.value
      entry && writeFieldStates(states => states.cleared(entry, filename))
      updating.value = false
      return
    }
    const endpoint = updateEndpoint.value
    lastSend = () => send(() => sendUpload($cwa, uploadIri, filename, uploadFile, endpoint))
    await lastSend()
  }

  async function confirmDelete() {
    const { confirmResourceAction } = await import('#cwa/admin/resource-confirm')
    return confirmResourceAction(vueApp, {
      title: `Delete this ${fileDisplayType.toLowerCase()}?`,
      description: 'This can\'t be undone.',
      keep: 'Don\'t delete',
      go: 'Delete',
    })
  }

  async function handleInputDeleteFile() {
    if (!fileExists.value || !iri.value) {
      return
    }
    if (!fileData.value) {
      releaseUpload($cwa, iri.value, filename)
      return
    }
    if (!await confirmDelete()) {
      return
    }
    lastSend = () => send(() => $cwa.resourcesManager.updateResource({
      endpoint: deleteEndpoint.value,
      data: {
        [filename]: null,
      },
      onRequest: fieldStateReporter($cwa, filename),
    }))
    await lastSend()
  }

  return {
    state,
    retry,
    reset,
    file,
    updating,
    fileExists,
    handleInputChangeFile,
    handleInputDeleteFile,
  }
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
