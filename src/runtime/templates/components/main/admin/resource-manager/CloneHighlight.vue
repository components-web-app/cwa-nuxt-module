<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useCwa } from '#imports'
import { useCloneMode } from '#cwa/admin/clone-mode'
import { instancesOf, onInstancesChange } from '#cwa/admin/manageable-instances'

const $cwa = useCwa()
const { source } = useCloneMode($cwa)
const redrawCount = ref(0)
const instances = computed(() => {
  void redrawCount.value
  return instancesOf($cwa, source.value?.iri)
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

const highlights = computed(() => {
  return instances.value.map(instance => boundsOf(instance.value)).filter(style => !!style)
})

function redraw() {
  redrawCount.value++
}

const stopInstances = onInstancesChange($cwa, redraw)

onMounted(() => {
  $cwa.admin.eventBus.on('redrawFocus', redraw)
  window.addEventListener('resize', redraw)
})

onBeforeUnmount(() => {
  stopInstances()
  $cwa.admin.eventBus.off('redrawFocus', redraw)
  window.removeEventListener('resize', redraw)
})
</script>

<template>
  <Teleport
    v-if="highlights.length"
    to="body"
  >
    <div
      v-for="(highlight, index) of highlights"
      :key="index"
      :style="highlight"
      data-testid="clone-highlight"
      class="cwa:absolute cwa:z-manager-focus cwa:outline-2 cwa:outline-dashed cwa:outline-yellow cwa:outline-offset-4 cwa:pointer-events-none cwa:rounded-[1px]"
    />
  </Teleport>
</template>
