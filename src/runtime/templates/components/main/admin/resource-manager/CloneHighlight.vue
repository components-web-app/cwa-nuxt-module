<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useCwa } from '#imports'
import { useCloneMode } from '#cwa/admin/clone-mode'
import { instancesOf, onInstancesChange } from '#cwa/admin/manageable-instances'
import { useNuxtApp } from '#app/nuxt'

const $cwa = useCwa()
const teleportTarget: HTMLElement | string = useNuxtApp().vueApp._container ?? 'body'
const { source, placed } = useCloneMode($cwa)
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

function boundsOf(elements: HTMLElement[]) {
  let top = Infinity
  let left = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const element of elements) {
    if (element.nodeType !== 1 || !element.isConnected) {
      continue
    }
    const rect = element.getBoundingClientRect()
    top = Math.min(top, rect.top)
    left = Math.min(left, rect.left)
    right = Math.max(right, rect.right)
    bottom = Math.max(bottom, rect.bottom)
  }
  if (top === Infinity) {
    return
  }
  const scrollY = Math.max(document.body.scrollTop, document.documentElement.scrollTop)
  const scrollX = Math.max(document.body.scrollLeft, document.documentElement.scrollLeft)
  return {
    top: `${top + scrollY}px`,
    left: `${left + scrollX}px`,
    width: `${right - left}px`,
    height: `${bottom - top}px`,
  }
}

const highlights = computed(() => {
  return instances.value
    .map(instance => ({ style: boundsOf(instance.value), origin: isOrigin(instance.value) }))
    .filter(highlight => !!highlight.style)
})

const placedHighlights = computed(() => {
  return placedInstances.value.map(instance => boundsOf(instance.value)).filter(style => !!style)
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
    v-if="highlights.length || placedHighlights.length"
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
      v-for="(style, index) of placedHighlights"
      :key="`placed-${index}`"
      :style="style"
      data-testid="clone-placed"
      class="cwa:absolute cwa:z-manager-focus cwa:outline-4 cwa:outline-solid cwa:outline-yellow cwa:outline-offset-4 cwa:pointer-events-none cwa:rounded-[1px] cwa:animate-clone-placed"
    />
  </Teleport>
</template>
