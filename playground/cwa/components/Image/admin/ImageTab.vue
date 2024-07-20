<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCwaResourceEndpoint } from '#cwa/runtime/composables/cwa-resource-endpoint'
import { useCwaResourceManagerTab } from '#imports'

const { exposeMeta, $cwa, iri, resource } = useCwaResourceManagerTab({
  name: 'Upload'
})

function getFilename () {
  return fileData.value ? `Existing Image (${fileData.value.formattedFileSize})` : ''
}

const fileData = computed(() => resource.value?.data?._metadata.mediaObjects?.file[0])

const filename = ref(getFilename())
const fileExists = ref(true)
const updating = ref(false)

defineExpose(exposeMeta)

const { endpoint: updateEndpoint } = useCwaResourceEndpoint(iri, '/upload')
const { endpoint: deleteEndpoint } = useCwaResourceEndpoint(iri)

async function uploadImage (newFile: File|undefined) {
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
  filename.value = getFilename()
  updating.value = false
}

async function deleteImage () {
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
  filename.value = ''
  updating.value = false
}
</script>

<template>
  <div>
    <CwaUiFormFile
      v-model="filename"
      label="Upload Image"
      :disabled="updating"
      :file-exists="fileExists"
      @change="uploadImage"
      @delete="deleteImage"
    />
  </div>
</template>
