<template>
  <div class="w-full relative">
    <div v-if="thumbnailMedia" class="relative flex overflow-hidden max-w-full h-96 max-h-screen">
      <NuxtImg
        v-if="thumbnailMedia"
        ref="image"
        :src="contentUrl"
        :width="thumbnailMedia?.width"
        :height="thumbnailMedia?.height"
        class="object-contain object-left-top"
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
import { useCwaImage } from '#cwa/runtime/composables/cwa-image'

const { exposeMeta, contentUrl, thumbnailMedia, handleLoad, loaded } = useCwaImage('thumbnail')
defineExpose(exposeMeta)
</script>
