<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { useCwa } from '#imports'
import { getPublishedResourceState } from '#cwa/runtime/resources/resource-utils'

const props = defineProps<{
  iri: Ref<string|undefined>
  domElements: ComputedRef<HTMLElement[]>
}>()
const $cwa = useCwa()

const domElements = toRef(props, 'domElements')
const iri = toRef(props, 'iri')
const canvas = ref<HTMLCanvasElement|undefined>()
const windowSize = ref({ width: 0, height: 0, timestamp: 0 })

const resource = computed(() => {
  if (!iri.value) {
    return
  }
  return $cwa.resources.getResource(iri.value).value
})

const resourceData = computed(() => resource.value?.data)

const position = computed((): {
  top: number
  left: number
  width: number
  height: number
} => {
  const clearCoords = {
    top: 999999999999,
    left: 99999999999,
    width: 0,
    height: 0,
    windowSize: windowSize.value
  }

  for (const domElement of domElements.value) {
    if (domElement.nodeType !== 1) {
      continue
    }
    const domRect = domElement.getBoundingClientRect()
    clearCoords.top = Math.min(clearCoords.top, domRect.top)
    clearCoords.left = Math.min(clearCoords.left, domRect.left)
    clearCoords.width = Math.max(clearCoords.width, domRect.right - clearCoords.left)
    clearCoords.height = Math.max(clearCoords.height, domRect.bottom - clearCoords.top)
  }

  const addY = Math.max(document.body.scrollTop, document.documentElement.scrollTop)
  clearCoords.top += addY

  const addX = Math.max(document.body.scrollLeft, document.documentElement.scrollLeft)
  clearCoords.left += addX

  return {
    top: clearCoords.top,
    left: clearCoords.left,
    width: clearCoords.width,
    height: clearCoords.height
  }
})

const cssStyle = computed(() => {
  return {
    top: `${position.value.top}px`,
    left: `${position.value.left}px`,
    width: `${position.value.width}px`,
    height: `${position.value.height}px`
  }
})

const borderColor = computed(() => {
  if (!resource.value) {
    return
  }
  if (resource.value.data?._metadata.adding) {
    return 'cwa-outline-orange'
  }
  const publishedState = getPublishedResourceState(resource.value)
  if (publishedState !== undefined) {
    return publishedState ? 'cwa-outline-green' : 'cwa-outline-orange'
  }
  return iri.value?.startsWith('/_/') ? 'cwa-outline-magenta' : 'cwa-outline-green'
})

function updateWindowSize () {
  windowSize.value = {
    width: window.innerWidth,
    height: window.innerHeight,
    timestamp: (new Date()).getTime()
  }
}

async function redraw () {
  await nextTick()
  updateWindowSize()
  drawCanvas()
}

function drawCanvas () {
  if (!canvas.value) {
    return
  }
  const ctx = canvas.value.getContext('2d')
  if (!ctx) {
    return
  }

  const offset = 7
  const width = Math.max(windowSize.value.width, document.body.clientWidth)
  const height = Math.max(windowSize.value.height, document.body.clientHeight)
  ctx.reset()

  canvas.value.width = width
  canvas.value.height = height
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.beginPath()
  ctx.rect(0, 0, width, height)
  drawRoundedRect(ctx, position.value.left - offset, position.value.top - offset, position.value.width + (offset * 2), position.value.height + (offset * 2), 8)
  ctx.fill()
}

function drawRoundedRect (ctx: CanvasRenderingContext2D, x:number, y:number, width:number, height:number, radius:number) {
  ctx.moveTo(x, y + radius)
  ctx.arcTo(x, y + height, x + radius, y + height, radius)
  ctx.arcTo(x + width, y + height, x + width, y + height - radius, radius)
  ctx.arcTo(x + width, y, x + width - radius, y, radius)
  ctx.arcTo(x, y, x, y + radius, radius)
}

let redrawInterval: number|undefined
onMounted(() => {
  $cwa.admin.eventBus.on('manageableComponentMounted', redraw)
  window.addEventListener('resize', redraw, false)
  watch(resourceData, redraw, { deep: true, flush: 'post' })
  watch(canvas, newCanvas => newCanvas && redraw())

  // fallbacks for if an image needs a short time to appear, or CLS
  setTimeout(() => {
    redraw()
  }, 10)
  setTimeout(() => {
    redraw()
  }, 100)
  setTimeout(() => {
    redraw()
  }, 250)

  // Periodic checks
  redrawInterval = window.setInterval(() => {
    redraw()
  }, 1000)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', redraw)
  $cwa.admin.eventBus.off('manageableComponentMounted', redraw)
  redrawInterval && window.clearInterval(redrawInterval)
})

defineExpose({
  redraw
})
</script>

<template>
  <client-only>
    <canvas ref="canvas" class="cwa-pointer-events-none cwa-absolute cwa-top-0 cwa-left-0" />
    <div :class="[borderColor]" :style="cssStyle" class="cwa-animate-pulse cwa-absolute cwa-outline-4 cwa-outline-offset-4 cwa-pointer-events-none cwa-outline cwa-rounded" />
  </client-only>
</template>
