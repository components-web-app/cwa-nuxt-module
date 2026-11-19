<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
const dragState = ref<PositionDragState>()

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

const grips = computed(() => {
  void redrawCount.value
  const { x, y } = scroll()
  return positions.value.flatMap((positionIri) => {
    const box = boxOf(positionIri)
    return box ? [{ positionIri, style: { top: `${box.top + y}px`, left: `${box.right + x}px` } }] : []
  })
})

const lineStyle = computed(() => {
  const line = dragState.value?.line
  if (!line) {
    return
  }
  const { x, y } = scroll()
  return { top: `${line.top + y}px`, left: `${line.left + x}px`, width: `${line.right - line.left}px` }
})

const ghostStyle = computed(() => {
  const ghost = dragState.value?.ghost
  if (!ghost) {
    return
  }
  const { x, y } = scroll()
  return { top: `${ghost.top + y}px`, left: `${ghost.left + x}px`, width: `${ghost.right - ghost.left}px`, height: `${ghost.bottom - ghost.top}px` }
})

const drag = createPositionDrag({
  positions: () => positions.value,
  boxOf,
  onReorder: event => $cwa.admin.eventBus.emit('reorder', event),
  onChange: (state) => {
    dragState.value = state
    held.value = state?.positionIri
  },
})

function positionAt(target: Node) {
  for (const positionIri of positions.value) {
    const element = elementsOf(positionIri).find(candidate => candidate.contains(target))
    if (element) {
      return { positionIri, element }
    }
  }
}

function press(event: PointerEvent) {
  const target = event.target
  if (!(target instanceof Element) || target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) {
    return
  }
  const found = positionAt(target)
  found && drag.start(event, found.positionIri, found.element)
}

let marked = new Map<HTMLElement, boolean>()

function applyMarks(wanted: Map<HTMLElement, boolean>) {
  for (const element of marked.keys()) {
    if (!wanted.has(element)) {
      element.removeAttribute('data-cwa-reorderable')
      element.removeAttribute('data-cwa-reorder-held')
    }
  }
  for (const [element, isHeld] of wanted) {
    element.setAttribute('data-cwa-reorderable', '')
    isHeld ? element.setAttribute('data-cwa-reorder-held', '') : element.removeAttribute('data-cwa-reorder-held')
  }
  marked = wanted
}

watch(() => {
  void redrawCount.value
  return [positions.value, held.value] as const
}, () => {
  const wanted = new Map<HTMLElement, boolean>()
  for (const positionIri of positions.value) {
    for (const element of elementsOf(positionIri)) {
      wanted.set(element, positionIri === held.value)
    }
  }
  applyMarks(wanted)
}, { immediate: true, flush: 'post' })

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
  document.addEventListener('pointerdown', press, true)
})

onBeforeUnmount(() => {
  frame !== undefined && cancelAnimationFrame(frame)
  drag.stop()
  stopInstances()
  applyMarks(new Map())
  $cwa.admin.eventBus.off('redrawFocus', redraw)
  window.removeEventListener('resize', redraw)
  document.removeEventListener('pointerdown', press, true)
})
</script>

<template>
  <Teleport :to="teleportTarget">
    <div
      v-for="grip of grips"
      :key="grip.positionIri"
      aria-hidden="true"
      :style="grip.style"
      data-testid="reorder-grip"
      class="cwa:pointer-events-none cwa:absolute cwa:z-manager-focus cwa:-ml-5 cwa:mt-1 cwa:flex cwa:size-4 cwa:items-center cwa:justify-center cwa:rounded-xs cwa:bg-magenta cwa:text-white cwa:shadow-sm"
    >
      <GripIcon class="cwa:size-3" />
    </div>
    <div
      v-if="ghostStyle"
      :style="ghostStyle"
      data-testid="reorder-ghost"
      class="cwa:pointer-events-none cwa:absolute cwa:z-manager-focus cwa:rounded-sm cwa:bg-magenta/10 cwa:outline-1 cwa:outline-solid cwa:outline-magenta/50"
    />
    <div
      v-if="lineStyle"
      :style="lineStyle"
      data-testid="reorder-drop-line"
      class="cwa:pointer-events-none cwa:absolute cwa:z-manager-focus cwa:-mt-px cwa:h-0.5 cwa:rounded-full cwa:bg-magenta"
    />
  </Teleport>
</template>
