<template>
  <div v-if="isOpen" ref="container" class="context-menu cwa-z-20">
    <Transition appear v-bind="transitions.context">
      <div :class="[ops.base, ops.ring, ops.rounded, ops.shadow, ops.background]">
        <div :class="[ops.backgroundInner]">
          <slot />
        </div>
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
import { useTransitions } from '#cwa/runtime/composables/transitions'

const transitions = useTransitions()

const ops = {
  background: 'cwa-bg-white/40 dark:cwa-bg-dark/40 dark:cwa-text-light cwa-backdrop-blur-xs cwa-rounded-md cwa-shadow',
  backgroundInner: 'cwa-bg-white/70 dark:cwa-bg-gray-900/70 cwa-backdrop-blur-lg cwa-rounded-md',
  shadow: 'cwa-shadow-lg',
  rounded: '',
  ring: '',
  base: 'cwa-overflow-hidden focus:cwa-outline-none cwa-pt-2 cwa-px-1 cwa-pb-1',
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
