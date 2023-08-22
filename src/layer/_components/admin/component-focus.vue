<script setup lang="ts">
import { computed, ComputedRef, onBeforeUnmount, onMounted, ref } from 'vue'
const props = defineProps<{
  domElements: ComputedRef<HTMLElement[]>
}>()

const windowSize = ref({ width: null, height: null })

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
  const css = {
    top: `${position.value.top}px`,
    left: `${position.value.left}px`,
    width: `${position.value.right - position.value.left}px`,
    height: `${position.value.bottom - position.value.top}px`
  }
  return css
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
</script>

<template>
  <client-only>
    <div class="component-focus cwa-pointer-events-none cwa-absolute cwa-animate-pulse" :style="cssStyle" />
  </client-only>
</template>

<style>
.component-focus {
  outline: 2px solid green;
  outline-offset: 2px;
  &:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    outline: .75rem solid rgba(0,0,0,.15);
    outline-offset: 4px;
  }
}
</style>
