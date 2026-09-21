<template>
  <div>
    <Transition
      enter-from-class="transform opacity-0"
      enter-active-class="duration-300 ease-out"
      enter-to-class="opacity-100"
      leave-from-class="opacity-100"
      leave-active-class="duration-300 ease-in"
      leave-to-class="transform opacity-0"
    >
      <!--
        v-show, NOT v-if: `loaded` is only ever set by this element's own @load, so gating the
        element on `loaded` meant it was never created, never loaded, and never displayed. It only
        appeared at all because of the `naturalHeight !== 0` polarity bug (#267) firing handleLoad
        on mount regardless. v-show keeps it in the DOM so it can actually load and fade in.
      -->
      <NuxtImg
        v-show="loaded"
        ref="file"
        :src="contentUrl"
        :width="displayMedia?.width"
        :height="displayMedia?.height"
        class="object-contain object-left-top"
        @load="handleLoad"
      />
    </Transition>
    <div
      data-placeholder="true"
      class="absolute top-0 left-0 w-full h-full overflow-hidden bg-gray-200 pointer-events-none cwa:transition-opacity"
      :class="{ 'opacity-0': loaded }"
    />
  </div>
</template>

<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { useCwa, useCwaFileField } from '#imports'

const props = defineProps<{
  iri: string
}>()

const $cwa = useCwa()

await $cwa.fetchResource({
  path: props.iri,
})

// Registered explicitly (#267): a cached image can finish loading before @load is attached, and
// this is the only thing that catches that. Must match `ref="file"` in the template above.
const imageRef = useTemplateRef<unknown>('file')
const { contentUrl, displayMedia, handleLoad, loaded } = useCwaFileField(props, { imagineFilterName: 'thumbnail', imageRef })
</script>
