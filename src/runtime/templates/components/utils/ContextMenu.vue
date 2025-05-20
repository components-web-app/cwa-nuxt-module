<template>
  <div
    v-if="isOpen"
    ref="container"
    class="context-menu cwa:z-20"
  >
    <Transition
      appear
      v-bind="transitions.context"
    >
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
import type { PopperOptions } from '../../../types/popper'
import { usePopper } from '#imports'
import { useTransitions } from '#cwa/runtime/composables/transitions'

const transitions = useTransitions()

const ops = {
  background: 'cwa:bg-white/40 cwa:dark:bg-dark/40 cwa:dark:text-light cwa:backdrop-blur-xs cwa:rounded-md cwa:shadow',
  backgroundInner: 'cwa:bg-white/70 cwa:dark:bg-dark/70 cwa:backdrop-blur-lg cwa:rounded-md',
  shadow: 'cwa:shadow-lg',
  rounded: '',
  ring: '',
  base: 'cwa:overflow-hidden cwa:focus:outline-hidden cwa:pt-2 cwa:px-1 cwa:pb-1',
  popper: {
    placement: 'bottom-start',
    scroll: false,
  },
}

const props = withDefaults(defineProps<{
  modelValue: boolean
  virtualElement: any
  popper?: PopperOptions
}>(), {
  modelValue: false,
  popper: undefined,
})

const emit = defineEmits(['update:modelValue', 'close'])

const popperOps = computed<PopperOptions>((): PopperOptions => defu({}, props.popper, ops.popper) as PopperOptions)

const isOpen = computed({
  get() {
    return props.modelValue
  },
  set(value) {
    emit('update:modelValue', value)
  },
})

const virtualElement = toRef(props, 'virtualElement') as Ref<VirtualElement>

const [, container] = usePopper(popperOps.value, virtualElement)

onClickOutside(container, () => {
  isOpen.value = false
})
</script>
