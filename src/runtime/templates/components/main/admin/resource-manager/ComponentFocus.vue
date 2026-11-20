<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, toRef, useTemplateRef, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { useElementSize, useWindowSize } from '@vueuse/core'
import { useCwa } from '#imports'
import { CwaResourceTypes, getPublishedResourceState, getResourceTypeFromIri } from '#cwa/resources/resource-utils'
import { FOCUS_CUTOUT_OFFSET, FOCUS_CUTOUT_RADIUS, focusRadiusAt, saveOutlineStyle, toneBehind, useSaveOutline } from '#cwa/admin/save-outline'
import { NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'

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
const measured = ref(0)
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

const fieldStates = computed(() => {
  const current = iri.value
  if (!current) {
    return []
  }
  const iris = current === NEW_RESOURCE_IRI ? [current] : $cwa.resources.findAllPublishableIris(current)
  return iris.flatMap(each => Object.values($cwa.resources.getResource(each).value?.fieldStates ?? {}))
})

const savePhase = useSaveOutline(fieldStates, iri)
const saveTone = computed(() => savePhase.value === 'rest' ? undefined : toneBehind(domElements.value[0]))
const sides = ['top', 'right', 'bottom', 'left'] as const

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
    measured: measured.value,
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
    borderRadius: `${focusRadiusAt(0)}px`,
  }
}

const cssStyle = computed(() => styleOf(position.value))
const otherCssStyles = computed(() => otherPositions.value.map(styleOf))

const MAGENTA_TYPES = [
  CwaResourceTypes.ROUTE,
  CwaResourceTypes.PAGE,
  CwaResourceTypes.LAYOUT,
  CwaResourceTypes.COMPONENT_GROUP,
  CwaResourceTypes.COMPONENT_POSITION,
]

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
  const type = iri.value ? getResourceTypeFromIri(iri.value) : undefined
  return type && MAGENTA_TYPES.includes(type) ? 'cwa:outline-magenta' : 'cwa:outline-green'
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

  const offset = FOCUS_CUTOUT_OFFSET
  const width = Math.max(windowSize.width.value, document.body.clientWidth)
  const height = Math.max(windowSize.height.value, document.body.clientHeight)
  ctx.reset()

  canvas.value.width = width
  canvas.value.height = height
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.beginPath()
  ctx.rect(0, 0, width, height)
  for (const cutOut of [position.value, ...otherPositions.value]) {
    drawRoundedRect(ctx, cutOut.left - offset, cutOut.top - offset, cutOut.width + (offset * 2), cutOut.height + (offset * 2), FOCUS_CUTOUT_RADIUS)
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

function remeasure() {
  measured.value++
}

function remeasureWhenShown() {
  document.visibilityState === 'visible' && remeasure()
}

onMounted(() => {
  $cwa.admin.eventBus.on('redrawFocus', redraw)
  $cwa.admin.eventBus.on('reorder', remeasure)
  window.addEventListener('focus', remeasure)
  document.addEventListener('visibilitychange', remeasureWhenShown)
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
  $cwa.admin.eventBus.off('reorder', remeasure)
  window.removeEventListener('focus', remeasure)
  document.removeEventListener('visibilitychange', remeasureWhenShown)
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
      v-for="(outlineStyle, index) of [cssStyle, ...otherCssStyles]"
      :key="index"
      :class="borderColor"
      :style="outlineStyle"
      :data-save="savePhase"
      class="cwa:absolute cwa:outline-2 cwa:outline-offset-4 cwa:pointer-events-none cwa:outline"
      data-testid="focus-outline"
    >
      <span
        v-if="savePhase !== 'rest'"
        :key="savePhase"
        class="cwa:focus-save"
        :style="saveOutlineStyle"
        :data-save="savePhase"
        :data-tone="saveTone"
        data-testid="focus-save"
      >
        <span class="cwa:focus-save-ring">
          <i
            v-for="side of sides"
            :key="side"
            :data-side="side"
          />
        </span>
      </span>
    </div>
  </client-only>
</template>
