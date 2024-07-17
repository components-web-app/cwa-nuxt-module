<script setup lang="ts">
import { ref } from 'vue'
import { useCwaResourceManagerTab } from '#imports'

const { exposeMeta, $cwa, iri } = useCwaResourceManagerTab({
  name: 'Upload'
})

const filename = ref('')
const fileExists = ref(true)

defineExpose(exposeMeta)

async function uploadImage (newFile: File|undefined) {
  if (!newFile || !iri.value) {
    return
  }
  const formData = new FormData()
  formData.append('file', newFile)
  await $cwa.resourcesManager.updateResource({
    endpoint: `${iri.value}/upload`,
    data: formData,
    headers: {
      accept: '*/*'
    }
  })
}

function deleteImage () {
  if (!fileExists.value) {
    return
  }
  filename.value = ''
}
</script>

<template>
  <div>
    <CwaUiFormFile v-model="filename" label="Upload Image" :file-exists="fileExists" @change="uploadImage" @delete="deleteImage" />
  </div>
</template>
