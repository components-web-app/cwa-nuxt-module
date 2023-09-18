<template>
  <div v-if="isOpen" ref="container" class="context-menu cwa-z-20">
    <Transition appear v-bind="ops.transition">
      <div :class="[ops.base, ops.ring, ops.rounded, ops.shadow, ops.background]">
        <slot />
      </div>
    </Transition>
  </div>
</template>

<script lang="ts" setup>
import { computed, toRef } from 'vue'
import type { Ref } from 'vue'
import { onClickOutside } from '@vueuse/core'
import type { VirtualElement } from '@popperjs/core'
import { defu } from 'defu'
import type { PopperOptions } from '../../../runtime/types'
import { usePopper } from '#imports'

const ops = {
  background: 'cwa-bg-white/80 dark:cwa-bg-gray-900/80 dark:cwa-text-white cwa-backdrop-blur-md',
  shadow: 'cwa-shadow-lg',
  rounded: '',
  ring: '',
  base: 'cwa-overflow-hidden focus:cwa-outline-none cwa-p-2',
  transition: {
    enterActiveClass: 'cwa-transition cwa-ease-out cwa-duration-200',
    enterFromClass: 'cwa-opacity-0 cwa-translate-y-1',
    enterToClass: 'cwa-opacity-100 cwa-translate-y-0',
    leaveActiveClass: 'cwa-transition cwa-ease-in cwa-duration-150',
    leaveFromClass: 'cwa-opacity-100 cwa-translate-y-0',
    leaveToClass: 'cwa-opacity-0 cwa-translate-y-1'
  },
  popper: {
    placement: 'bottom-start',
    scroll: false
  }
}

const props = withDefaults(defineProps<{
  modelValue: boolean
  virtualElement: any
  popper?: PopperOptions
  ui?: Partial<typeof ui>
}>(), {
  modelValue: false,
  popper: {},
  ui: () => ({})
})

const emit = defineEmits(['update:modelValue', 'close'])

const popperOps = computed<PopperOptions>(() => defu({}, props.popper, ops.popper))

const isOpen = computed({
  get () {
    return props.modelValue
  },
  set (value) {
    emit('update:modelValue', value)
  }
})

const virtualElement = toRef(props, 'virtualElement') as Ref<VirtualElement>

const [, container] = usePopper(popperOps.value, virtualElement)

onClickOutside(container, () => {
  isOpen.value = false
})
</script>
