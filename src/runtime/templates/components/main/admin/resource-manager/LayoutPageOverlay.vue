<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useWindowSize } from '@vueuse/core'
import { useCwa } from '#cwa/runtime/composables/cwa'

const canvas = useTemplateRef<HTMLCanvasElement | undefined>('canvas')
const windowSize = useWindowSize()

const $cwa = useCwa()

const props = defineProps<{
  page: HTMLDivElement
  layout: HTMLDivElement
}>()

async function redraw() {
  drawCanvas()
  divElementOverlays.value = getDivElementOverlays()
}

function getHatchCanvas() {
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

  pctx.strokeStyle = 'rgba(255,255,255, .1)'
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

function drawCanvas() {
  if (!canvas.value) {
    return
  }
  const ctx = canvas.value.getContext('2d')
  if (!ctx) {
    return
  }

  const width = Math.max(windowSize.width.value, document.body.clientWidth)
  const height = Math.max(windowSize.height.value, document.body.clientHeight)
  ctx.reset()

  canvas.value.width = width
  canvas.value.height = height
  const hatchCanvas = getHatchCanvas()
  ctx.fillStyle = hatchCanvas ? (ctx.createPattern(hatchCanvas, 'repeat') || 'rgba(0,0,0,0.4)') : 'rgba(0,0,0,0.4)'
  ctx.beginPath()
  if ($cwa.admin.resourceStackManager.isEditingLayout.value) {
    drawLayoutFocus(ctx)
  }
  else {
    drawPageFocus(ctx)
  }
  ctx.fill()
}

function drawPageFocus(ctx: CanvasRenderingContext2D) {
  const [layoutRect] = getBoundingRect()
  const pageCoords = getPageCoords()

  const rightPage = pageCoords.left + pageCoords.width
  const bottomPage = pageCoords.top + pageCoords.height

  const coordsThree = { x: layoutRect.width, y: bottomPage }
  const pageFocusCoords: { x: number, y: number }[] = [
    { x: layoutRect.width, y: 0 }, // 2
    coordsThree, // 3
    { x: rightPage, y: bottomPage }, // 4
    { x: rightPage, y: pageCoords.top }, // 5
    { x: pageCoords.left, y: pageCoords.top }, // 6
    { x: pageCoords.left, y: bottomPage }, // 7
    coordsThree, // 8
    { x: layoutRect.width, y: layoutRect.height }, // 9
    { x: 0, y: layoutRect.height }, // 10
    // it will return to start automatically when finished 0:0
  ]

  ctx.moveTo(0, 0)
  for (const coords of pageFocusCoords) {
    ctx.lineTo(coords.x, coords.y)
  }
}

function drawLayoutFocus(ctx: CanvasRenderingContext2D) {
  const pageCoords = getPageCoords()
  ctx.moveTo(pageCoords.left, pageCoords.top)
  ctx.lineTo(pageCoords.left + pageCoords.width, pageCoords.top)
  ctx.lineTo(pageCoords.left + pageCoords.width, pageCoords.top + pageCoords.height)
  ctx.lineTo(pageCoords.left, pageCoords.top + pageCoords.height)
}

function getBoundingRect() {
  return [
    props.layout.getBoundingClientRect(),
    props.page.getBoundingClientRect(),
  ]
}

const getPageCoords = () => {
  const [layoutRect, pageRect] = getBoundingRect()
  return {
    top: pageRect.top - layoutRect.top,
    left: pageRect.left - layoutRect.left,
    width: pageRect.width,
    height: pageRect.height,
  }
}

onMounted(() => {
  $cwa.admin.eventBus.on('redrawFocus', redraw)
  watch(canvas, newCanvas => newCanvas && redraw())
})

onBeforeUnmount(() => {
  $cwa.admin.eventBus.off('redrawFocus', redraw)
})

type DivElementOverlayType = {
  top: string
  left: string
  width: string
  height: string
}

function getDivElementOverlays() {
  const pageCoords = getPageCoords()

  const numberToPx = (size: number) => {
    return `${size}px`
  }

  if ($cwa.admin.resourceStackManager.isEditingLayout.value) {
    return [
      {
        top: numberToPx(pageCoords.top),
        left: numberToPx(pageCoords.left),
        width: numberToPx(pageCoords.width),
        height: numberToPx(pageCoords.height),
      },
    ]
  }

  const [layoutRect] = getBoundingRect()

  const rightPage = pageCoords.left + pageCoords.width
  const bottomPage = pageCoords.top + pageCoords.height

  return [
    {
      top: '0',
      left: '0',
      width: numberToPx(layoutRect.width),
      height: numberToPx(pageCoords.top),
    },
    {
      top: numberToPx(pageCoords.top),
      left: '0',
      width: numberToPx(pageCoords.left),
      height: numberToPx(pageCoords.height),
    },
    {
      top: numberToPx(pageCoords.top),
      left: numberToPx(rightPage),
      width: numberToPx(layoutRect.width - rightPage),
      height: numberToPx(pageCoords.height),
    },
    {
      top: numberToPx(bottomPage),
      left: '0',
      width: numberToPx(layoutRect.width),
      height: numberToPx(layoutRect.height - bottomPage),
    },
  ]
}

const divElementOverlays = ref<DivElementOverlayType[]>(getDivElementOverlays())
</script>

<template>
  <ClientOnly>
    <div class="cwa:pointer-events-none cwa:absolute cwa:top-0 cwa:left-0">
      <div
        v-for="(overlay, index) of divElementOverlays"
        :key="`cwa-admin-overlay-${index}`"
        :style="overlay"
        class="cwa:absolute cwa:pointer-events-none cwa:backdrop-blur-[1.5px] cwa:bg-black/30"
      />
      <canvas
        id="cwa-layout-page-overlay"
        ref="canvas"
        class="cwa:absolute cwa:top-0 cwa:left-0 cwa:pointer-events-none"
      />
    </div>
  </ClientOnly>
</template>
