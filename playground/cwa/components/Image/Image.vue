<template>
  <div class="w-full relative">
    <div v-if="!loaded" data-placeholder="true" class="w-20 h-20 overflow-hidden bg-gray-200 relative" :style="{ width: `${thumbnailMedia?.width}px`, height: `${thumbnailMedia?.height}px` }" />
    <NuxtImg v-if="thumbnailMedia" :src="thumbnailMedia?.contentUrl" :width="thumbnailMedia?.width" :height="thumbnailMedia?.height" @load="handleLoad" />
  </div>
</template>

<script setup lang="ts">
import type { IriProp } from '#cwa/runtime/composables/cwa-resource'
import { computed, ref, toRef } from 'vue'
import { useCwaResource } from '#imports'

type MediaFile = {
  contentUrl: string
  fileSize: number
  mimeType: string
  formattedFileSize: string
  imagineFilter?: string
  width?: number
  height?: number
}

const props = defineProps<IriProp>()

const { getResource, exposeMeta } = useCwaResource(toRef(props, 'iri'))
const resource = getResource()

const loaded = ref(false)

function handleLoad () {
  loaded.value = true
}

const imageFileMediaObjects = computed<MediaFile[]|undefined>(() => {
  return resource.value?.data?._metadata.mediaObjects?.file
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
