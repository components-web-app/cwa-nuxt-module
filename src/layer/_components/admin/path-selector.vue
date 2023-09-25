<template>
  <div v-if="stackItem && stackSize" ref="pathSelector">
    <div
      class="cwa-py-2 cwa-px-4 cwa-bg-neutral-800 cwa-border cwa-border-dashed cwa-text-white"
      :class="[isEnabled ? 'hover:cwa-bg-gray-900 cwa-cursor-pointer' : '']"
      @click="openMenu"
    >
      {{ stackItem.displayName }}
    </div>
    <Transition appear v-bind="transitions.context">
      <div v-if="isOpen" class="cwa-absolute cwa-top-0 cwa-left-1/2 -cwa-translate-x-1/2 cwa-w-full cwa-box-content" :style="{ marginTop: marginTop, paddingLeft: paddingX, paddingRight: paddingX }">
        <div class="cwa-absolute cwa-top-0 cwa-left-0 cwa-w-full cwa-bg-dark">
          <resource-context-item :index="stackSize - 1" @click="index => selectResource(index)" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onClickOutside } from '@vueuse/core'
import ResourceContextItem from '#cwa/layer/_components/admin/resource-context-item.vue'
import { useCwa } from '#cwa/runtime/composables/cwa'
import { useTransitions } from '#cwa/runtime/composables/transitions'

const $cwa = useCwa()
const transitions = useTransitions()

const stackSize = computed(() => $cwa.admin.componentManager.resourceStack.value.length)
const spacingStackSize = computed(() => stackSize.value - 1)

const isOpen = ref(false)
const pathSelector = ref(null)

const isEnabled = computed(() => {
  return stackSize.value > 1
})
const marginTop = computed(() => {
  return spacingStackSize.value ? `calc(0px - ${spacingStackSize.value}px - ${spacingStackSize.value * 0.25}rem)` : 0
})
const paddingX = computed(() => {
  return `calc(${spacingStackSize.value * 0.5}rem + ${spacingStackSize.value}px)` // spacingStackSize.value ? `calc(${stackSize.value * 0.5}rem - ${spacingStackSize.value}px)` : 0
})
const stackItem = computed(() => {
  return $cwa.admin.componentManager.resourceStack.value[0]
})

function selectResource (index: number) {
  $cwa.admin.componentManager.selectStackIndex(index)
  isOpen.value = false
}

function openMenu () {
  if (!isEnabled.value) {
    isOpen.value = false
    return
  }
  isOpen.value = true
}

onClickOutside(pathSelector, event => isOpen.value = false)
</script>
