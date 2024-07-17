<template>
  <div>
    <div data-placeholder="true" class="h-40 w-40 overflow-hidden relative bg-gray-200" />
    <img v-if="thumbnailMedia" :src="thumbnailMedia?.contentUrl">
  </div>
</template>

<script setup lang="ts">
import type { IriProp } from '#cwa/runtime/composables/cwa-resource'
import { computed, toRef } from 'vue'
import { useCwaResource } from '#imports'

const props = defineProps<IriProp>()

const { getResource, exposeMeta } = useCwaResource(toRef(props, 'iri'))
const resource = getResource()

type MediaFile = {
  contentUrl: string
  fileSize: number
  mimeType: string
  formattedFileSize: string
  imagineFilter?: string
  width?: number
  height?: number
}

const imageFileMediaObjects = computed<MediaFile[]|undefined>(() => {
  return resource.value?.data?._metadata.mediaObjects.file
})

const thumbnailMedia = computed(() => {
  if (!imageFileMediaObjects.value || !imageFileMediaObjects.value.length) {
    return
  }
  const thumbnail = imageFileMediaObjects.value.filter(({ imagineFilter }) => (imagineFilter === 'thumbnail'))
  return thumbnail?.[0] || imageFileMediaObjects.value[0]
})

defineExpose(exposeMeta)
</script>
