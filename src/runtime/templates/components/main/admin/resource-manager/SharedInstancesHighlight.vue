<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, unref, watch } from 'vue'
import type { Ref } from 'vue'
import { useCwa } from '#cwa/composables/cwa'
import { instancesOf, onInstancesChange } from '#cwa/admin/manageable-instances'
import { useNuxtApp } from '#app/nuxt'

const $cwa = useCwa()
const teleportTarget: Element | string = useNuxtApp().vueApp._container ?? 'body'
const selected = $cwa.admin.resourceStackManager.currentStackItem
const redrawCount = ref(0)

const otherInstances = computed(() => {
  void redrawCount.value
  const item = selected.value
  if (!item) {
    return []
  }
  const selectedElements = new Set(unref(item.domElements as Ref<HTMLElement[]> | HTMLElement[] | undefined) ?? [])
  return instancesOf($cwa, item.iri).filter(instance => !instance.value.some(element => selectedElements.has(element)))
})

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

const outlines = computed(() => otherInstances.value.map(instance => boundsOf(instance.value)).filter(style => !!style))

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

watch(() => [$cwa.resources.displayPageIri.value, $cwa.resources.isLoading.value], redrawAfterRender)

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
    v-if="outlines.length"
    :to="teleportTarget"
  >
    <div
      v-for="(outline, index) of outlines"
      :key="index"
      :style="outline"
      data-testid="shared-instance-outline"
      title="Also used here"
      class="cwa:absolute cwa:z-manager-focus cwa:outline-2 cwa:outline-dotted cwa:outline-white/60 cwa:outline-offset-4 cwa:pointer-events-none cwa:rounded-[1px]"
    />
  </Teleport>
</template>
