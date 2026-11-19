<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, toValue, watch } from 'vue'
import type { Ref } from 'vue'
import { useCwa } from '#cwa/composables/cwa'
import { boundsOf, instancesAt } from '#cwa/admin/manageable-instances'
import { useCloneMode } from '#cwa/admin/clone-mode'
import { CwaResourceTypes, getResourceTypeFromIri } from '#cwa/resources/resource-utils'
import { useNuxtApp } from '#app/nuxt'

const $cwa = useCwa()
const teleportTarget: Element | string = useNuxtApp().vueApp._container ?? 'body'
const cloneTarget = useCloneMode($cwa).target
const hovered = shallowRef<Ref<HTMLElement[]>>()
const hoverKey = ref(0)
const redrawCount = ref(0)
const pointerHovers = typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches

function innermostComponentAt(node: Node) {
  let innermost: { element: HTMLElement, elements: Ref<HTMLElement[]> } | undefined
  for (const { iri, elements } of instancesAt($cwa, node)) {
    if (getResourceTypeFromIri(iri) !== CwaResourceTypes.COMPONENT) {
      continue
    }
    const element = elements.value.find(candidate => candidate.contains(node))!
    if (!innermost || innermost.element.contains(element)) {
      innermost = { element, elements }
    }
  }
  return innermost?.elements
}

function onMouseOver(event: MouseEvent) {
  const now = event.target instanceof Node ? innermostComponentAt(event.target) : undefined
  if (now !== hovered.value) {
    hovered.value = now
    hoverKey.value++
  }
}

function onMouseOut(event: MouseEvent) {
  if (!event.relatedTarget) {
    hovered.value = undefined
  }
}

function overlaps(elements: HTMLElement[], others: readonly HTMLElement[] | undefined) {
  return !!others?.length && elements.some(element => others.includes(element))
}

const outline = computed(() => {
  void redrawCount.value
  const elements = hovered.value?.value
  if (!elements?.length) {
    return
  }
  const selected = toValue($cwa.admin.resourceStackManager.currentStackItem.value?.domElements)
  if (overlaps(elements, selected) || overlaps(elements, cloneTarget.value)) {
    return
  }
  return boundsOf(elements)
})

const outlined = computed(() => outline.value ? hovered.value?.value ?? [] : [])

watch(outlined, (elements, _, onCleanup) => {
  for (const element of elements) {
    element.setAttribute('data-cwa-hovered', '')
  }
  onCleanup(() => {
    for (const element of elements) {
      element.removeAttribute('data-cwa-hovered')
    }
  })
}, { immediate: true })

function redraw() {
  redrawCount.value++
}

onMounted(() => {
  if (!pointerHovers) {
    return
  }
  document.addEventListener('mouseover', onMouseOver)
  document.addEventListener('mouseout', onMouseOut)
  window.addEventListener('scroll', redraw, true)
  window.addEventListener('resize', redraw)
  $cwa.admin.eventBus.on('redrawFocus', redraw)
})

onBeforeUnmount(() => {
  document.removeEventListener('mouseover', onMouseOver)
  document.removeEventListener('mouseout', onMouseOut)
  window.removeEventListener('scroll', redraw, true)
  window.removeEventListener('resize', redraw)
  $cwa.admin.eventBus.off('redrawFocus', redraw)
})
</script>

<template>
  <Teleport
    v-if="outline"
    :to="teleportTarget"
  >
    <div
      :key="hoverKey"
      :style="outline"
      data-testid="hover-outline"
      class="cwa:absolute cwa:z-peer-outline cwa:outline-1 cwa:outline-solid cwa:outline-offset-4 cwa:outline-accent-fg/40 cwa:pointer-events-none cwa:rounded-[1px] cwa:motion-safe:animate-[cwa-line-in_150ms_ease-out]"
    />
  </Teleport>
</template>
