<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import type { ComputedRef } from 'vue'
import { resourcesConfig } from '#build/cwa-config'
import { useCwa } from '#cwa/composables/cwa'
import { instancesOf, onInstancesChange } from '#cwa/admin/manageable-instances'
import { createPositionDrag } from '#cwa/admin/position-drag'
import type { DragBox, PositionDragState } from '#cwa/admin/position-drag'
import GripIcon from '#cwa/templates/components/ui/icon/GripIcon.vue'
import { useNuxtApp } from '#app/nuxt'

const props = defineProps<{ groupIri: string }>()

const $cwa = useCwa()
const teleportTarget: Element | string = useNuxtApp().vueApp._container ?? 'body'
const redrawCount = ref(0)
const held = ref<string>()
const dropLine = ref<PositionDragState['line']>()

const positions = computed(() => $cwa.resources.getOrderedPositionsForGroup(props.groupIri) ?? [])

function elementsOf(positionIri: string) {
  return (instancesOf($cwa, positionIri)[0]?.value ?? []).filter(element => element.nodeType === 1 && element.isConnected)
}

function boxOf(positionIri: string): DragBox | undefined {
  let box: DragBox | undefined
  for (const element of elementsOf(positionIri)) {
    const rect = element.getBoundingClientRect()
    box = box
      ? { top: Math.min(box.top, rect.top), bottom: Math.max(box.bottom, rect.bottom), left: Math.min(box.left, rect.left), right: Math.max(box.right, rect.right) }
      : { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right }
  }
  return box
}

function scroll() {
  return {
    x: Math.max(document.body.scrollLeft, document.documentElement.scrollLeft),
    y: Math.max(document.body.scrollTop, document.documentElement.scrollTop),
  }
}

const componentIris = new Map<string, ComputedRef<string | undefined>>()

function componentName(positionIri: string) {
  let componentIri = componentIris.get(positionIri)
  if (!componentIri) {
    componentIri = $cwa.resources.positionComponentIri(positionIri)
    componentIris.set(positionIri, componentIri)
  }
  const type = componentIri.value ? $cwa.resources.getResource(componentIri.value).value?.data?.['@type'] : undefined
  return (type && resourcesConfig[type]?.name) || type || 'component'
}

const handles = computed(() => {
  void redrawCount.value
  const { x, y } = scroll()
  return positions.value.flatMap((positionIri) => {
    const box = boxOf(positionIri)
    return box ? [{ positionIri, label: `Drag to reorder ${componentName(positionIri)}`, style: { top: `${box.top + y}px`, left: `${box.left + x}px` } }] : []
  })
})

const lineStyle = computed(() => {
  const line = dropLine.value
  if (!line) {
    return
  }
  const { x, y } = scroll()
  return { top: `${line.top + y}px`, left: `${line.left + x}px`, width: `${line.right - line.left}px` }
})

const drag = createPositionDrag({
  positions: () => positions.value,
  boxOf,
  onReorder: event => $cwa.admin.eventBus.emit('reorder', event),
  onChange: (state) => {
    dropLine.value = state?.line
    if (!state) {
      held.value = undefined
    }
  },
})

function press(event: PointerEvent, positionIri: string) {
  held.value = positionIri
  drag.start(event, positionIri, event.currentTarget as HTMLElement)
}

function release() {
  held.value = undefined
}

let wobbling = new Map<HTMLElement, string>()

function applyWobble(wanted: Map<HTMLElement, string>) {
  for (const [element, className] of wobbling) {
    wanted.get(element) !== className && element.classList.remove(className)
  }
  for (const [element, className] of wanted) {
    element.classList.add(className)
  }
  wobbling = wanted
}

watchEffect(() => {
  void redrawCount.value
  const wanted = new Map<HTMLElement, string>()
  positions.value.forEach((positionIri, index) => {
    if (positionIri === held.value) {
      return
    }
    for (const element of elementsOf(positionIri)) {
      wanted.set(element, index % 2 ? 'cwa:reorder-wobble-alt' : 'cwa:reorder-wobble')
    }
  })
  applyWobble(wanted)
}, { flush: 'post' })

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

watch(() => [$cwa.resources.displayPageIri.value, $cwa.resources.isLoading.value, positions.value], redrawAfterRender)

onMounted(() => {
  $cwa.admin.eventBus.on('redrawFocus', redraw)
  window.addEventListener('resize', redraw)
})

onBeforeUnmount(() => {
  frame !== undefined && cancelAnimationFrame(frame)
  drag.stop()
  stopInstances()
  applyWobble(new Map())
  $cwa.admin.eventBus.off('redrawFocus', redraw)
  window.removeEventListener('resize', redraw)
})
</script>

<template>
  <Teleport :to="teleportTarget">
    <button
      v-for="handle of handles"
      :key="handle.positionIri"
      type="button"
      tabindex="-1"
      aria-hidden="true"
      :aria-label="handle.label"
      :title="handle.label"
      :style="handle.style"
      data-testid="reorder-handle"
      :data-held="held === handle.positionIri || undefined"
      class="cwa:absolute cwa:z-manager-focus cwa:m-1 cwa:flex cwa:size-control cwa:pointer-coarse:size-hit cwa:items-center cwa:justify-center cwa:rounded-sm cwa:bg-magenta cwa:text-white cwa:shadow-md cwa:cursor-grab cwa:touch-none cwa:select-none cwa:data-held:cursor-grabbing"
      @pointerdown="press($event, handle.positionIri)"
      @pointerup="release"
      @pointercancel="release"
      @click.stop.prevent
      @contextmenu.stop.prevent
    >
      <GripIcon class="cwa:size-5" />
    </button>
    <div
      v-if="lineStyle"
      :style="lineStyle"
      data-testid="reorder-drop-line"
      class="cwa:pointer-events-none cwa:absolute cwa:z-manager-focus cwa:-mt-px cwa:h-0.5 cwa:rounded-full cwa:bg-magenta"
    />
  </Teleport>
</template>
