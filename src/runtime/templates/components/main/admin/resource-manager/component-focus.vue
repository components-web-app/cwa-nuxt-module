<script setup lang="ts">
import { computed, ComputedRef, onBeforeUnmount, onMounted, Ref, ref, toRef } from 'vue'
import { useCwa } from '#imports'
import { getPublishedResourceState } from '#cwa/runtime/resources/resource-utils'

const $cwa = useCwa()
const props = defineProps<{
  iri: Ref<string>
  domElements: ComputedRef<HTMLElement[]>
}>()

const windowSize = ref({ width: 0, height: 0 })

const position = computed(() => {
  const clearCoords = {
    top: 999999999999,
    left: 99999999999,
    right: 0,
    bottom: 0,
    windowSize: windowSize.value
  }
  for (const domElement of props.domElements.value) {
    if (domElement.nodeType !== 1) {
      continue
    }
    const domRect = domElement.getBoundingClientRect()
    clearCoords.top = Math.min(clearCoords.top, domRect.top)
    clearCoords.left = Math.min(clearCoords.left, domRect.left)
    clearCoords.right = Math.max(clearCoords.right, domRect.right)
    clearCoords.bottom = Math.max(clearCoords.bottom, domRect.bottom)
  }
  const addY = Math.max(document.body.scrollTop, document.documentElement.scrollTop)
  clearCoords.top += addY
  clearCoords.bottom += addY
  const addX = Math.max(document.body.scrollLeft, document.documentElement.scrollLeft)
  clearCoords.left += addX
  clearCoords.right += addX
  return clearCoords
})

const cssStyle = computed(() => {
  return {
    top: `${position.value.top}px`,
    left: `${position.value.left}px`,
    width: `${position.value.right - position.value.left}px`,
    height: `${position.value.bottom - position.value.top}px`
  }
})

function updateWindowSize () {
  windowSize.value = {
    width: window.innerWidth,
    height: window.innerHeight
  }
}

onMounted(() => {
  window.addEventListener('resize', updateWindowSize, false)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateWindowSize)
})

const iri = toRef(props, 'iri')

const borderColor = computed(() => {
  if (!resource.value) {
    return
  }
  const publishedState = getPublishedResourceState(resource.value)
  if (publishedState !== undefined) {
    return publishedState ? 'cwa-outline-green' : 'cwa-outline-orange'
  }
  return iri.value.startsWith('/_/') ? 'cwa-outline-magenta' : 'cwa-outline-green'
})

const resource = computed(() => {
  return $cwa.resources.getResource(iri.value).value
})
</script>

<template>
  <client-only>
    <div class="component-focus cwa-pointer-events-none cwa-absolute cwa-outline cwa-outline-offset-[7px] cwa-outline-[99999rem] cwa-rounded" :style="cssStyle">
      <div :class="[borderColor]" class="cwa-animate-pulse cwa-absolute cwa-top-0 cwa-left-0 cwa-w-full cwa-h-full cwa-outline-4 cwa-outline-offset-4 cwa-pointer-events-none cwa-outline cwa-rounded" />
    </div>
  </client-only>
</template>

<style>

.component-focus {
  outline-color: rgba(0,0,0,.4);
}
</style>
