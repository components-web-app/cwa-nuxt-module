import { computed, type ComputedRef, ref } from 'vue'
import { useCwaResourceEndpoint } from '#cwa/runtime/composables/cwa-resource-endpoint'
import { useCwa } from '#cwa/runtime/composables/cwa'

export const useCwaResourceUpload = (iri: ComputedRef<string|undefined>) => {
  const $cwa = useCwa()
  const resource = computed(() => iri.value ? $cwa.resources.getResource(iri.value).value : undefined)

  function getFilename () {
    return fileData.value ? `Existing Image (${fileData.value.formattedFileSize})` : ''
  }

  const fileData = computed(() => resource.value?.data?._metadata.mediaObjects?.file[0])

  const filenameInputModel = ref(getFilename())
  const fileExists = ref(true)
  const updating = ref(false)

  const { endpoint: updateEndpoint } = useCwaResourceEndpoint(iri, '/upload')
  const { endpoint: deleteEndpoint } = useCwaResourceEndpoint(iri)

  async function handleInputChangeFile (newFile: File|undefined) {
    if (!newFile || !iri.value) {
      return
    }
    updating.value = true
    const formData = new FormData()
    formData.append('file', newFile)
    await $cwa.resourcesManager.updateResource({
      iri: iri.value,
      endpoint: updateEndpoint.value,
      data: formData,
      headers: {
        accept: '*/*'
      }
    })
    filenameInputModel.value = getFilename()
    updating.value = false
  }

  async function handleInputDeleteFile () {
    if (!fileExists.value || !iri.value) {
      return
    }
    updating.value = true
    await $cwa.resourcesManager.updateResource({
      endpoint: deleteEndpoint.value,
      data: {
        file: null
      }
    })
    fileExists.value = false
    filenameInputModel.value = ''
    updating.value = false
  }

  return {
    filenameInputModel,
    updating,
    fileExists,
    handleInputChangeFile,
    handleInputDeleteFile
  }
}
