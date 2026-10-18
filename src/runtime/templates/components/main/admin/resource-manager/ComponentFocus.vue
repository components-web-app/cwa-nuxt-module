<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, toRef, useTemplateRef, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { useElementSize, useWindowSize } from '@vueuse/core'
import { v4 as uuidv4 } from 'uuid'
import { useCwa } from '#imports'
import { getPublishedResourceState } from '#cwa/resources/resource-utils'

const props = defineProps<{
  iri: Ref<string | undefined>
  domElements: ComputedRef<HTMLElement[]>
}>()
const $cwa = useCwa()

const domElements = toRef(props, 'domElements')
const iri = toRef(props, 'iri')
const canvas = useTemplateRef<HTMLCanvasElement | undefined>('canvas')
const windowSize = useWindowSize()
const elementSizeInstances = ref<ReturnType<typeof useElementSize>[]>([])
const reorderId = ref<string>()
const manageableInstances = shallowRef<typeof import('#cwa/admin/manageable-instances')>()
const instancesVersion = ref(0)
let isUnmounted = false
let stopInstances: (() => void) | undefined
import('#cwa/admin/manageable-instances').then((module) => {
  if (isUnmounted) {
    return
  }
  manageableInstances.value = module
  stopInstances = module.onInstancesChange($cwa, () => {
    instancesVersion.value++
  })
})
const instances = computed(() => {
  void instancesVersion.value
  return manageableInstances.value?.instancesOf($cwa, iri.value) ?? []
})
const otherInstances = computed(() => instances.value.filter(instance => instance !== props.domElements))

watch(() => [...domElements.value, ...otherInstances.value.flatMap(instance => instance.value)], (newDomElements) => {
  for (const esInstance of elementSizeInstances.value) {
    esInstance.stop()
  }
  elementSizeInstances.value = []
  const newInstances = []
  for (const el of newDomElements) {
    newInstances.push(useElementSize(el))
  }
  elementSizeInstances.value = newInstances
}, {
  immediate: true,
})

const totalWidthAndHeight = computed(() => {
  let totalValue = 0
  for (const esInstance of elementSizeInstances.value) {
    totalValue += esInstance.width + esInstance.height
  }
  return totalValue
})

const resource = computed(() => {
  if (!iri.value) {
    return
  }
  return $cwa.resources.getResource(iri.value).value
})

type FocusPosition = {
  top: number
  left: number
  width: number
  height: number
}

function boundsOf(elements: HTMLElement[]): FocusPosition {
  const clearCoords = {
    top: 999999999999,
    left: 99999999999,
    width: 0,
    height: 0,
    windowSize: {
      width: windowSize.width.value,
      height: windowSize.height.value,
    },
    totalWidthAndHeight: totalWidthAndHeight.value,
    reorderId: reorderId.value,
  }

  for (const domElement of elements) {
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
    height: clearCoords.height,
  }
}

const position = computed(() => boundsOf(domElements.value))
const otherPositions = computed(() => otherInstances.value.map(instance => boundsOf(instance.value)))

function styleOf(focusPosition: FocusPosition) {
  return {
    top: `${focusPosition.top}px`,
    left: `${focusPosition.left}px`,
    width: `${focusPosition.width}px`,
    height: `${focusPosition.height}px`,
  }
}

const cssStyle = computed(() => styleOf(position.value))
const otherCssStyles = computed(() => otherPositions.value.map(styleOf))

const borderColor = computed(() => {
  if (!resource.value) {
    return
  }
  if (resource.value.data?._metadata.adding) {
    return 'cwa:outline-orange'
  }
  const publishedState = getPublishedResourceState(resource.value)
  if (publishedState !== undefined) {
    return publishedState ? 'cwa:outline-green' : 'cwa:outline-orange'
  }
  return iri.value?.startsWith('/_/') ? 'cwa:outline-magenta' : 'cwa:outline-green'
})

async function redraw() {
  drawCanvas()
}

function drawCanvas() {
  if (!canvas.value) {
    return
  }
  const ctx = canvas.value.getContext('2d')
  if (!ctx) {
    return
  }

  const offset = 7
  const width = Math.max(windowSize.width.value, document.body.clientWidth)
  const height = Math.max(windowSize.height.value, document.body.clientHeight)
  ctx.reset()

  canvas.value.width = width
  canvas.value.height = height
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.beginPath()
  ctx.rect(0, 0, width, height)
  for (const cutOut of [position.value, ...otherPositions.value]) {
    drawRoundedRect(ctx, cutOut.left - offset, cutOut.top - offset, cutOut.width + (offset * 2), cutOut.height + (offset * 2), 8)
  }
  ctx.fill()
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.moveTo(x, y + radius)
  ctx.arcTo(x, y + height, x + radius, y + height, radius)
  ctx.arcTo(x + width, y + height, x + width, y + height - radius, radius)
  ctx.arcTo(x + width, y, x + width - radius, y, radius)
  ctx.arcTo(x, y, x, y + radius, radius)
}

function assignReorderId() {
  reorderId.value = uuidv4()
}

onMounted(() => {
  $cwa.admin.eventBus.on('redrawFocus', redraw)
  $cwa.admin.eventBus.on('reorder', assignReorderId)
  watch([totalWidthAndHeight, position, otherPositions], $cwa.admin.emitRedraw)
  watch(canvas, newCanvas => newCanvas && redraw())
  watch(() => resource.value?.data, async () => {
    await nextTick()
    redraw()
  })
})

onBeforeUnmount(() => {
  isUnmounted = true
  stopInstances?.()
  $cwa.admin.eventBus.off('redrawFocus', redraw)
  $cwa.admin.eventBus.off('reorder', assignReorderId)
})

defineExpose({
  redraw,
})
</script>

<template>
  <client-only>
    <canvas
      ref="canvas"
      class="cwa:z-manager-focus cwa:pointer-events-none cwa:absolute cwa:top-0 cwa:left-0"
    />
    <div
      :class="[borderColor]"
      :style="cssStyle"
      class="cwa:animate-pulse cwa:absolute cwa:outline-2 cwa:outline-offset-4 cwa:pointer-events-none cwa:outline cwa:rounded-[1px]"
    />
    <div
      v-for="(otherCssStyle, index) of otherCssStyles"
      :key="index"
      :class="[borderColor]"
      :style="otherCssStyle"
      class="cwa:animate-pulse cwa:absolute cwa:outline-2 cwa:outline-offset-4 cwa:pointer-events-none cwa:outline cwa:rounded-[1px]"
    />
  </client-only>
</template>
