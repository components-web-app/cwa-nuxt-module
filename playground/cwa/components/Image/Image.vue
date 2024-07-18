<template>
  <div class="w-full relative">
    <div v-if="thumbnailMedia" class="relative" :style="{ width: `${thumbnailMedia?.width}px`, height: `${thumbnailMedia?.height}px` }">
      <NuxtImg
        v-if="thumbnailMedia"
        ref="image"
        :src="thumbnailMedia?.contentUrl"
        :width="thumbnailMedia?.width"
        :height="thumbnailMedia?.height"
        @load="handleLoad"
      />
      <div data-placeholder="true" class="absolute top-0 left-0 w-full h-full overflow-hidden bg-gray-200 pointer-events-none cwa-transition-opacity" :class="{ 'opacity-0': loaded }" />
    </div>
    <div v-else>
      <div data-placeholder="true" class="relative w-40 h-40 overflow-hidden bg-gray-200 pointer-events-none flex items-center justify-center text-gray-500 font-bold">
        No Image
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IriProp } from '#cwa/runtime/composables/cwa-resource'
import { computed, onMounted, ref, toRef } from 'vue'
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
const image = ref()

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

onMounted(() => {
  if (image.value.complete || image.value.naturalHeight !== 0) {
    handleLoad()
  }
})

defineExpose(exposeMeta)
</script>
