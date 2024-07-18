<script setup lang="ts">
import { computed, ref } from 'vue'
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

async function uploadImage (newFile: File|undefined) {
  if (!newFile || !iri.value) {
    return
  }
  updating.value = true
  const formData = new FormData()
  formData.append('file', newFile)
  await $cwa.resourcesManager.updateResource({
    endpoint: `${iri.value}/upload`,
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
    endpoint: iri.value,
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
