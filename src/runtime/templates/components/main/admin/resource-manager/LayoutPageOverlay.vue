<script lang="ts" setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useCwa } from '#cwa/runtime/composables/cwa'

const canvas = ref<HTMLCanvasElement|undefined>()
const windowSize = ref({ width: 0, height: 0, timestamp: 0 })

const $cwa = useCwa()

const props = defineProps<{
  page: HTMLDivElement,
  layout: HTMLDivElement
}>()

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

function getHatchCanvas () {
  const p = document.createElement('canvas')
  p.width = 32
  p.height = 16
  const pctx = p.getContext('2d')
  if (!pctx) {
    return
  }

  const x0 = 36
  const x1 = -4
  const y0 = -2
  const y1 = 18
  const offset = 32

  pctx.strokeStyle = 'rgba(0,0,0,0.1)'
  pctx.lineWidth = 5
  pctx.beginPath()
  pctx.moveTo(x0, y0)
  pctx.lineTo(x1, y1)
  pctx.moveTo(x0 - offset, y0)
  pctx.lineTo(x1 - offset, y1)
  pctx.moveTo(x0 + offset, y0)
  pctx.lineTo(x1 + offset, y1)
  pctx.stroke()
  return p
}

function drawCanvas () {
  if (!canvas.value) {
    return
  }
  const ctx = canvas.value.getContext('2d')
  if (!ctx) {
    return
  }

  const width = Math.max(windowSize.value.width, document.body.clientWidth)
  const height = Math.max(windowSize.value.height, document.body.clientHeight)
  ctx.reset()

  canvas.value.width = width
  canvas.value.height = height
  const hatchCanvas = getHatchCanvas()
  ctx.fillStyle = hatchCanvas ? (ctx.createPattern(hatchCanvas, 'repeat') || 'rgba(0,0,0,0.4)') : 'rgba(0,0,0,0.4)'
  ctx.beginPath()
  if ($cwa.admin.resourceManager.isEditingLayout.value) {
    drawLayoutFocus(ctx)
  } else {
    drawPageFocus(ctx)
  }
  ctx.fill()
}

function drawPageFocus (ctx: CanvasRenderingContext2D) {
  const [layoutRect] = getBoundingRect()
  const pageCoords = getPageCoords()
  ctx.moveTo(0, 0)
  ctx.lineTo(layoutRect.width, 0)
  ctx.lineTo(layoutRect.width, pageCoords.top + pageCoords.height)
  ctx.lineTo(pageCoords.left + pageCoords.width, pageCoords.top + pageCoords.height)
  ctx.lineTo(pageCoords.left + pageCoords.width, pageCoords.top)
  ctx.lineTo(pageCoords.left, pageCoords.top)
  ctx.lineTo(pageCoords.left, pageCoords.top + pageCoords.height)
  ctx.lineTo(layoutRect.width, pageCoords.top + pageCoords.height)
  ctx.lineTo(layoutRect.width, layoutRect.height)
  ctx.lineTo(0, layoutRect.height)
}

function drawLayoutFocus (ctx: CanvasRenderingContext2D) {
  const pageCoords = getPageCoords()
  ctx.moveTo(pageCoords.left, pageCoords.top)
  ctx.lineTo(pageCoords.left + pageCoords.width, pageCoords.top)
  ctx.lineTo(pageCoords.left + pageCoords.width, pageCoords.top + pageCoords.height)
  ctx.lineTo(pageCoords.left, pageCoords.top + pageCoords.height)
}

function getBoundingRect () {
  return [
    props.layout.getBoundingClientRect(),
    props.page.getBoundingClientRect()
  ]
}

const getPageCoords = () => {
  const [layoutRect, pageRect] = getBoundingRect()
  return {
    top: pageRect.top - layoutRect.top,
    left: pageRect.left - layoutRect.left,
    width: pageRect.width,
    height: pageRect.height
  }
}

let redrawInterval: number|undefined
onMounted(() => {
  $cwa.admin.eventBus.on('componentMounted', redraw)
  window.addEventListener('resize', redraw, false)
  watch(canvas, newCanvas => newCanvas && redraw())
  watch($cwa.admin.resourceManager.isEditingLayout, () => (redraw()))

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
  $cwa.admin.eventBus.off('componentMounted', redraw)
  redrawInterval && window.clearInterval(redrawInterval)
})
</script>

<template>
  <ClientOnly>
    <canvas id="cwa-layout-page-overlay" ref="canvas" class="cwa-pointer-events-none cwa-absolute cwa-top-0 cwa-left-0" />
  </ClientOnly>
</template>
