<template>
  <div
    v-if="stackItem && stackSize"
    ref="pathSelector"
  >
    <div
      class="cwa:py-1.5 cwa:px-3 cwa:bg-neutral-800 cwa:border cwa:border-dashed cwa:text-white"
      :class="[isEnabled ? 'cwa:hover:bg-dark cwa:cursor-pointer' : '']"
      @click="openMenu"
    >
      <span :class="{ 'cwa:opacity-0 cwa:duration-200': isOpen }">{{ stackItem.displayName }}</span>
    </div>
    <Transition v-bind="transitions.context">
      <div
        v-if="isOpen"
        class="cwa:absolute cwa:top-0 cwa:left-1/2 cwa:-translate-x-1/2 cwa:min-w-full cwa:box-content cwa:inline-block"
        :style="{ marginTop: marginTop, transformOrigin: tOrig }"
      >
        <div class="cwa:relative cwa:bg-dark cwa:inline-block">
          <resource-context-item
            :index="stackSize - 1"
            :root-width="selectorWidth"
            :use-current-stack="true"
            @click="index => selectResource(index)"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { onClickOutside } from '@vueuse/core'
import ResourceContextItem from '../../_common/ResourceContextItem.vue'
import { useCwa } from '#cwa/runtime/composables/cwa'
import { useTransitions } from '#cwa/runtime/composables/transitions'

const $cwa = useCwa()
const transitions = useTransitions()

const isOpen = ref(false)
const pathSelector = useTemplateRef<HTMLElement | null>('pathSelector')

const stackSize = computed(() => $cwa.admin.resourceStackManager.resourceStack.value.length)
const spacingStackSize = computed(() => stackSize.value - 1)
const tOrig = computed(() => {
  const pathSelectorEl = pathSelector.value
  if (!pathSelectorEl) {
    return
  }
  const buttonOffset = Math.round(pathSelectorEl.offsetHeight / 2)
  return `50% calc(${buttonOffset}px + ${stackSize.value}px + ${spacingStackSize.value * 0.25}rem)`
})

const isEnabled = computed(() => {
  return stackSize.value > 1
})
const marginTop = computed(() => {
  return spacingStackSize.value ? `calc(0px - ${spacingStackSize.value}px - ${spacingStackSize.value * 0.25}rem)` : 0
})
const stackItem = computed(() => {
  return $cwa.admin.resourceStackManager.resourceStack.value[0]
})
const selectorWidth = computed(() => {
  const pathSelectorEl = pathSelector.value
  // reactive to display name changing
  return stackItem.value?.displayName && pathSelectorEl ? pathSelectorEl.clientWidth : undefined
})

function selectResource(index: number) {
  $cwa.admin.resourceStackManager.selectStackIndex(index, false)
  isOpen.value = false
}

function openMenu() {
  if (!isEnabled.value) {
    isOpen.value = false
    return
  }
  isOpen.value = true
}

onClickOutside(pathSelector, () => {
  isOpen.value = false
})
</script>
