import { computed, ref, watch } from 'vue'
import type { ComputedRef } from 'vue'
import { useCwaResourceEndpoint } from '#cwa/composables/cwa-resource-endpoint'
import { useCwa } from '#cwa/composables/cwa'
import { createConfirmDialog } from '#cwa/admin/confirm-dialog'
import { useNuxtApp } from '#imports'
import ConfirmDialog from '#cwa/templates/components/core/ConfirmDialog.vue'
import { writeFieldStates } from '#cwa/resources/field-state-writer'
import type { CwaResource } from '#cwa/resources/resource-utils'
import type { CwaFieldState } from '#cwa/storage/stores/resources/state'
import { createBrowserImageDownscaleDeps, downscaleImageFile, resolveImageDownscaleOptions } from '#cwa/files/image-downscale'
import type { ImageDownscaleOptions } from '#cwa/files/image-downscale'

export interface CwaResourceUploadOps {
  imageDownscale?: Partial<ImageDownscaleOptions>
}

export interface CwaResourceUploadBind {
  'modelValue': string | number | undefined | null
  'onUpdate:modelValue': (value: string | number | undefined | null) => void
  'fileExists': boolean
  'disabled': boolean
  'onChange': (newFile: File | undefined) => Promise<void>
  'onDelete': () => Promise<void>
}

export const useCwaResourceUpload = (iri: ComputedRef<string | undefined>, filename: string = 'file', fileDisplayType: string = 'File', ops?: CwaResourceUploadOps) => {
  const $cwa = useCwa()
  const vueApp = useNuxtApp().vueApp
  const resource = computed(() => iri.value ? $cwa.resources.getResource(iri.value).value : undefined)

  function getFilename() {
    return fileData.value ? `Existing ${fileDisplayType} (${fileData.value.formattedFileSize})` : ''
  }

  const fileData = computed(() => resource.value?.data?._metadata.mediaObjects?.[filename]?.[0])

  const filenameInputModel = ref(getFilename())
  const fileExists = computed(() => !!fileData.value)
  const updating = ref(false)

  watch(fileData, () => {
    filenameInputModel.value = getFilename()
  })

  const IDLE: CwaFieldState = { status: 'idle', waiting: false, slow: false }
  const state = computed<CwaFieldState>(() => resource.value?.fieldStates?.[filename] ?? IDLE)
  let lastSend: (() => Promise<void>) | undefined

  function onRequest(sentTo: string, done?: Promise<{ resource?: CwaResource, error?: any }>) {
    const sending = $cwa.resources.getResource(sentTo).value
    if (!done) {
      return
    }
    writeFieldStates(states => states.started(sending, [filename]))
    done.then(({ resource: answer, error }) => writeFieldStates(states => states.settled(sending, [filename], answer, error, at => $cwa.resources.getResource(at).value)))
  }

  async function send(run: () => Promise<unknown>) {
    updating.value = true
    try {
      await run()
    }
    finally {
      updating.value = false
    }
  }

  function retry() {
    return lastSend ? lastSend() : Promise.resolve()
  }

  async function reset() {
    lastSend = undefined
    const entry = resource.value
    entry && writeFieldStates(states => states.cleared(entry, filename))
  }

  const file = computed(() => fileData.value
    ? {
        name: decodeURIComponent(fileData.value.contentUrl?.split('?')[0]?.split('/').pop() || fileDisplayType),
        size: fileData.value.formattedFileSize as string,
        url: fileData.value.contentUrl as string | undefined,
        mimeType: fileData.value.mimeType as string | undefined,
      }
    : undefined)

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
    lastSend = () => send(() => {
      const formData = new FormData()
      formData.append(filename, uploadFile)
      return $cwa.resourcesManager.updateResource({
        iri: uploadIri,
        endpoint: updateEndpoint.value,
        data: formData,
        headers: {
          accept: '*/*',
        },
        onRequest,
      })
    })
    await lastSend()
  }

  async function confirmDelete() {
    const alertData = {
      title: `Delete this ${fileDisplayType.toLowerCase()}?`,
      content: `<p>Are you sure you want to permanently delete this ${fileDisplayType.toLowerCase()}?</p>`,
    }
    const dialog = await createConfirmDialog(vueApp, ConfirmDialog)
    const { isCanceled } = await dialog.reveal(alertData)

    return !isCanceled
  }

  async function handleInputDeleteFile() {
    if (!fileExists.value || !iri.value) {
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
      onRequest,
    }))
    await lastSend()
  }

  const bind = computed<CwaResourceUploadBind>(() => ({
    'modelValue': filenameInputModel.value,
    'onUpdate:modelValue': (value) => {
      filenameInputModel.value = (value ?? '') as string
    },
    'fileExists': fileExists.value,
    'disabled': updating.value,
    'onChange': handleInputChangeFile,
    'onDelete': handleInputDeleteFile,
  }))

  return {
    state,
    retry,
    reset,
    file,
    filenameInputModel,
    updating,
    fileExists,
    handleInputChangeFile,
    handleInputDeleteFile,
    bind,
  }
}
