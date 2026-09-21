<template>
  <div class="w-full relative my-5">
    <div
      v-if="files.file?.displayMedia"
      class="relative flex overflow-hidden max-w-[300px]"
    >
      <NuxtImg
        ref="file"
        :src="files.file.contentUrl"
        :width="files.file.displayMedia?.width"
        :height="files.file.displayMedia?.height"
        class="max-w-full h-auto"
        :style="{ 'aspect-ratio': `${files.file.displayMedia.width} / ${files.file.displayMedia.height}` }"
        @load="files.file.handleLoad"
      />
      <div
        data-placeholder="true"
        class="absolute top-0 left-0 w-full h-full overflow-hidden bg-gray-200 pointer-events-none cwa:transition-opacity"
        :class="{ 'opacity-0': files.file.loaded }"
      />
    </div>
    <div v-else>
      <div
        data-placeholder="true"
        class="relative w-40 h-40 overflow-hidden bg-gray-200 pointer-events-none flex items-center justify-center text-gray-500 font-bold"
      >
        No Image
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTemplateRef } from 'vue'
import type { IriProp } from '#cwa/composables/cwa-resource'
import { useCwaComponent, withFile } from '#imports'

const props = defineProps<IriProp>()
// Opt in to the already-loaded-on-mount check by registering the ref ourselves (#267 — it is no
// longer implicit). `ref="file"` is on <NuxtImg>, so this resolves to the component instance;
// useCwaFile unwraps it to its root <img> via $el.
const imageRef = useTemplateRef<unknown>('file')
const { exposeMeta, files } = useCwaComponent(props, [withFile({ imagineFilterName: 'thumbnail', imageRef })])
defineExpose(exposeMeta)
</script>
