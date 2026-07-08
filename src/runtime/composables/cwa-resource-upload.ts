import { computed, ref, watch } from 'vue'
import type { ComputedRef } from 'vue'
import { createConfirmDialog } from 'vuejs-confirm-dialog'
import { useCwaResourceEndpoint } from '#cwa/composables/cwa-resource-endpoint'
import { useCwa } from '#cwa/composables/cwa'
import ConfirmDialog from '#cwa/templates/components/core/ConfirmDialog.vue'

// Ready-to-spread bindings for `CwaUiFormFile` (`v-bind="upload.bind"`). Covers the input's
// `v-model`, `fileExists`, `disabled` and its `change`/`delete` events — `label`/`accept` are left
// to the caller so each field keeps its own UI. Typed against the component's contract.
export interface CwaResourceUploadBind {
  'modelValue': string | number | undefined | null
  'onUpdate:modelValue': (value: string | number | undefined | null) => void
  'fileExists': boolean
  'disabled': boolean
  'onChange': (newFile: File | undefined) => Promise<void>
  'onDelete': () => Promise<void>
}

export const useCwaResourceUpload = (iri: ComputedRef<string | undefined>, filename: string = 'file', fileDisplayType: string = 'File') => {
  const $cwa = useCwa()
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

  const { endpoint: updateEndpoint } = useCwaResourceEndpoint(iri, '/upload')
  const { endpoint: deleteEndpoint } = useCwaResourceEndpoint(iri)

  async function handleInputChangeFile(newFile: File | undefined) {
    if (!newFile || !iri.value) {
      return
    }
    updating.value = true
    const formData = new FormData()
    formData.append(filename, newFile)
    await $cwa.resourcesManager.updateResource({
      iri: iri.value,
      endpoint: updateEndpoint.value,
      data: formData,
      headers: {
        accept: '*/*',
      },
    })
    updating.value = false
  }

  async function confirmDelete() {
    const alertData = {
      title: `Delete this ${fileDisplayType.toLowerCase()}?`,
      content: `<p>Are you sure you want to permanently delete this ${fileDisplayType.toLowerCase()}?</p>`,
    }
    // @ts-expect-error-next-line
    const dialog = createConfirmDialog(ConfirmDialog)
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
    updating.value = true
    await $cwa.resourcesManager.updateResource({
      endpoint: deleteEndpoint.value,
      data: {
        [filename]: null,
      },
    })
    updating.value = false
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
    filenameInputModel,
    updating,
    fileExists,
    handleInputChangeFile,
    handleInputDeleteFile,
    bind,
  }
}
