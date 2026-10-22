<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useCwa } from '#imports'
import { useCloneMode } from '#cwa/admin/clone-mode'
import { boundsOf, instancesOf, onInstancesChange } from '#cwa/admin/manageable-instances'
import { useNuxtApp } from '#app/nuxt'

const $cwa = useCwa()
const teleportTarget: Element | string = useNuxtApp().vueApp._container ?? 'body'
const { source, placed, target } = useCloneMode($cwa)
const redrawCount = ref(0)
const instances = computed(() => {
  void redrawCount.value
  return instancesOf($cwa, source.value?.iri)
})
const originElements = computed(() => {
  void redrawCount.value
  return instancesOf($cwa, source.value?.positionIri).flatMap(instance => instance.value)
})
const placedInstances = computed(() => {
  void redrawCount.value
  return instancesOf($cwa, placed.value)
})

function isOrigin(elements: HTMLElement[]) {
  return elements.some(element => originElements.value.some(origin => origin.contains(element)))
}

const highlights = computed(() => {
  return instances.value
    .map(instance => ({ style: boundsOf(instance.value), origin: isOrigin(instance.value) }))
    .filter(highlight => !!highlight.style)
})

const placedHighlights = computed(() => {
  return placedInstances.value.map(instance => boundsOf(instance.value)).filter(style => !!style)
})

const targetHighlight = computed(() => {
  void redrawCount.value
  return target.value && boundsOf([...target.value])
})

function redraw() {
  redrawCount.value++
}

let frame: number | undefined

function redrawAfterRender() {
  redraw()
  void nextTick(() => {
    frame !== undefined && cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      frame = undefined
      redraw()
    })
  })
}

const stopInstances = onInstancesChange($cwa, redrawAfterRender)

watch(() => [$cwa.resources.displayPageIri.value, $cwa.resources.isLoading.value, placed.value], redrawAfterRender)

onMounted(() => {
  $cwa.admin.eventBus.on('redrawFocus', redraw)
  window.addEventListener('resize', redraw)
})

onBeforeUnmount(() => {
  frame !== undefined && cancelAnimationFrame(frame)
  stopInstances()
  $cwa.admin.eventBus.off('redrawFocus', redraw)
  window.removeEventListener('resize', redraw)
})
</script>

<template>
  <Teleport
    v-if="highlights.length || placedHighlights.length || targetHighlight"
    :to="teleportTarget"
  >
    <div
      v-for="(highlight, index) of highlights"
      :key="index"
      :style="highlight.style"
      :data-origin="highlight.origin || undefined"
      data-testid="clone-highlight"
      :class="[highlight.origin ? 'cwa:outline-solid cwa:outline-4' : 'cwa:outline-dashed cwa:outline-2', 'cwa:absolute cwa:z-manager-focus cwa:outline-yellow cwa:outline-offset-4 cwa:pointer-events-none cwa:rounded-[1px]']"
    />
    <div
      v-if="targetHighlight"
      :style="targetHighlight"
      data-testid="clone-target"
      class="cwa:absolute cwa:z-manager-focus cwa:outline-2 cwa:outline-dashed cwa:outline-blue-600 cwa:outline-offset-2 cwa:pointer-events-none cwa:rounded-[1px]"
    />
    <div
      v-for="(style, index) of placedHighlights"
      :key="`placed-${index}`"
      :style="style"
      data-testid="clone-placed"
      class="cwa:absolute cwa:z-manager-focus cwa:outline-4 cwa:outline-solid cwa:outline-yellow cwa:outline-offset-4 cwa:pointer-events-none cwa:rounded-[1px] cwa:animate-clone-placed"
    />
  </Teleport>
</template>
