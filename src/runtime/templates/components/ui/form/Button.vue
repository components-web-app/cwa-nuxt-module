<script lang="ts" setup>
import { computed, useSlots } from 'vue'
import { defu } from 'defu'
import {
  Popover,
  PopoverButton,
  PopoverPanel
} from '@headlessui/vue'
import type { PopperOptions } from '#cwa/runtime/types/popper'
import { usePopper } from '#cwa/runtime/composables/popper'
import ButtonPopoverGroup from '#cwa/runtime/templates/components/ui/form/ButtonPopoverGroup.vue'
import ButtonPopoverItem from '#cwa/runtime/templates/components/ui/form/ButtonPopoverItem.vue'
const slots = useSlots()

export type ModelValue = undefined | string | number | boolean | object | null | (string | number | boolean | object)[]

export interface ButtonOption {
  label: string,
  value: ModelValue
}

const props = withDefaults(defineProps<
{
  color?: 'blue' | 'grey' | 'dark',
  buttonClass?: string,
  options?:(ButtonOption|ButtonOption[])[],
  popper?: PopperOptions
}>(), {
  color: 'grey',
  buttonClass: undefined,
  options: undefined,
  popper: undefined
})

const emit = defineEmits<{(e: 'click', value?: ModelValue): void}>()

const buttonColorClassNames = computed(() => {
  if (props.color === 'blue') {
    return 'cwa-text-white cwa-bg-blue-600/90 hover:cwa-bg-blue-600 cwa-border-transparent'
  }
  if (props.color === 'dark') {
    return 'cwa-text-light cwa-bg-dark/90 hover:cwa-bg-dark cwa-border-stone-400 hover:cwa-border-white hover:cwa-text-white'
  }
  return 'cwa-text-white cwa-bg-stone-700/90 hover:cwa-bg-stone-700 cwa-border-transparent'
})

const buttonBaseClass = computed(() => {
  return `${buttonColorClassNames.value} cwa-py-1.5 cwa-px-3 md:cwa-px-4 cwa-border cwa-transition`
})

const buttonClassNames = computed(() => {
  const baseClass = `cwa-flex-grow ${buttonBaseClass.value} ${props.buttonClass}`
  return `${baseClass} ${buttonColorClassNames.value}`
})

const hasOptions = computed(() => {
  return props.options?.length
})

function handleOptionClick (value: ModelValue, close: () => void) {
  close()
  emit('click', value)
}

// dot classes
const dotClassName = ['cwa-w-[0.3rem]', 'cwa-h-[0.3rem]', 'cwa-rounded-full', 'cwa-bg-white', 'cwa-absolute', 'cwa-left-1/2', '-cwa-translate-x-1/2']
const middleDotClassName = [...dotClassName, 'cwa-top-1/2 -cwa-translate-y-1/2']
const topDotClassName = [...dotClassName, 'cwa-top-2']
const bottomDotClassName = [...dotClassName, 'cwa-bottom-2']

const enforcedOps: PopperOptions = {
  placement: 'top-start',
  offsetDistance: 0
}
const popperOps = computed<PopperOptions>(() => defu({}, props.popper, enforcedOps))
const [trigger, container] = usePopper(popperOps.value)
</script>

<template>
  <Popover v-slot="{ open }" class="cwa-flex cwa-space-x-1.5 relative">
    <button v-if="slots.default" :class="[buttonClassNames, open ? 'cwa-opacity-50' : '']" :disabled="open" @click.prevent.stop="emit('click')">
      <slot />
    </button>
    <template v-if="hasOptions">
      <PopoverButton ref="trigger" :class="buttonBaseClass" class="cwa-relative">
        &nbsp;
        <span :class="topDotClassName" />
        <span :class="middleDotClassName" />
        <span :class="bottomDotClassName" />
      </PopoverButton>
      <PopoverPanel v-slot="{ close }" ref="container" class="cwa-absolute cwa-min-w-[220px] cwa-w-full cwa-max-w-[300px] cwa-bg-stone-700">
        <div v-for="(option, index) of options" :key="`popover-group-option-${index}`">
          <ButtonPopoverGroup v-if="Array.isArray(option)" :options="option" @click="(value: ModelValue) => handleOptionClick(value, close)" />
          <ButtonPopoverItem v-else :option="option" @click="(value: ModelValue) => handleOptionClick(value, close)" />
        </div>
      </PopoverPanel>
    </template>
  </Popover>
</template>
