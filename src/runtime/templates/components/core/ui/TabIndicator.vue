<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'

export interface TabBox { left: number, width: number }

const { measure = (tab: HTMLElement): TabBox => ({ left: tab.offsetLeft, width: tab.offsetWidth }) } = defineProps<{
  measure?: (tab: HTMLElement) => TabBox
}>()

const root = useTemplateRef<HTMLElement>('root')
const box = ref<TabBox>()
const slide = ref(false)
let selectedTab: HTMLElement | undefined
let resizes: ResizeObserver | undefined
let mutations: MutationObserver | undefined
const sized = new WeakSet<Element>()

function tabsOf(strip: HTMLElement) {
  return [...strip.children].filter((child): child is HTMLElement => child.getAttribute('role') === 'tab')
}

function observeTabs(strip: HTMLElement) {
  for (const tab of tabsOf(strip)) {
    if (!sized.has(tab)) {
      sized.add(tab)
      resizes?.observe(tab)
    }
  }
}

function update() {
  const strip = root.value?.parentElement
  const tab = strip && tabsOf(strip).find(candidate => candidate.getAttribute('aria-selected') === 'true')
  if (!tab) {
    selectedTab = undefined
    box.value = undefined
    return
  }
  const next = measure(tab)
  const moved = !box.value || box.value.left !== next.left || box.value.width !== next.width
  if (moved || tab !== selectedTab) {
    slide.value = !!selectedTab && tab !== selectedTab && selectedTab.parentElement === strip
  }
  selectedTab = tab
  box.value = next
}

onMounted(() => {
  const strip = root.value?.parentElement
  if (!strip) {
    return
  }
  if (typeof ResizeObserver !== 'undefined') {
    resizes = new ResizeObserver(() => update())
    resizes.observe(strip)
    observeTabs(strip)
  }
  if (typeof MutationObserver !== 'undefined') {
    mutations = new MutationObserver(() => {
      observeTabs(strip)
      update()
    })
    mutations.observe(strip, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-selected'] })
  }
  update()
})

onBeforeUnmount(() => {
  resizes?.disconnect()
  mutations?.disconnect()
})
</script>

<template>
  <span
    v-show="box"
    ref="root"
    aria-hidden="true"
    data-testid="tab-indicator"
    class="cwa:pointer-events-none cwa:absolute cwa:bottom-0 cwa:left-0 cwa:h-0.5 cwa:bg-accent"
    :class="{ 'cwa:transition-[translate,width] cwa:duration-(--cwa-duration-indicator) cwa:ease-(--cwa-ease-out) cwa:motion-reduce:transition-none': slide }"
    :style="box ? { translate: `${box.left}px 0`, width: `${box.width}px` } : undefined"
  />
</template>
