<script lang="ts" setup>
import { computed, Comment, Text } from 'vue'
import type { VNode, Slot } from 'vue'
import { defu } from 'defu'
import {
  Popover,
  PopoverButton,
  PopoverPanel,
} from '@headlessui/vue'
import type { RouteLocationRaw } from 'vue-router'
import type { PopperOptions } from '#cwa/runtime/types/popper'
import { usePopper } from '#cwa/runtime/composables/popper'
import ButtonPopoverGroup from '#cwa/runtime/templates/components/ui/form/ButtonPopoverGroup.vue'
import ButtonPopoverItem from '#cwa/runtime/templates/components/ui/form/ButtonPopoverItem.vue'
import Spinner from '#cwa/runtime/templates/components/utils/Spinner.vue'
import { NuxtLink } from '#components'

export type ModelValue = undefined | string | number | boolean | object | null | (string | number | boolean | object)[]

export interface ButtonOption {
  label: string
  value: ModelValue
}

export type ButtonColor = 'blue' | 'grey' | 'dark' | 'error'

const props = withDefaults(defineProps<
  {
    color?: ButtonColor
    buttonClass?: string
    options?: (ButtonOption | ButtonOption[])[]
    popper?: PopperOptions
    disabled?: boolean
    loading?: boolean
    to?: RouteLocationRaw
  }>(), {
  color: 'grey',
  buttonClass: undefined,
  options: undefined,
  popper: undefined,
  disabled: false,
  loading: false,
  to: undefined,
})

const slots = defineSlots<{
  default(p: typeof props): any
}>()

const emit = defineEmits<{ (e: 'click', value?: ModelValue): void }>()

const buttonColorClassNames = computed(() => {
  if (props.color === 'blue') {
    return 'cwa:text-white cwa:bg-blue-600/90 cwa:hover:bg-blue-600 cwa:border-transparent'
  }
  if (props.color === 'dark') {
    return 'cwa:text-light cwa:bg-dark/90 cwa:hover:bg-dark cwa:border-stone-400 cwa:hover:border-white cwa:hover:text-white'
  }
  if (props.color === 'error') {
    return 'cwa:text-light cwa:bg-magenta/80 cwa:hover:bg-magenta cwa:border-magenta cwa:hover:border-magenta cwa:hover:text-white'
  }
  return 'cwa:text-white cwa:bg-stone-700/90 cwa:hover:bg-stone-700 cwa:border-transparent'
})

const buttonBaseClass = computed(() => {
  return `${buttonColorClassNames.value} cwa:cursor-pointer cwa:py-1.5 cwa:px-3 cwa:md:px-4 cwa:border cwa:transition cwa:disabled:pointer-events-none cwa:disabled:opacity-70 cwa:disabled:saturate-[.4]`
})

const buttonClassNames = computed(() => {
  const baseClass = `cwa:grow ${buttonBaseClass.value} ${props.buttonClass}`
  return `${baseClass} ${buttonColorClassNames.value}`
})

const hasOptions = computed(() => {
  return props.options?.length
})

function handleOptionClick(value: ModelValue, close: () => void) {
  close()
  emit('click', value)
}

function hasSlotContent(slot: Slot | undefined, slotProps = {}): boolean {
  if (!slot) {
    return false
  }

  return slot(slotProps).some((vnode: VNode) => {
    if (vnode.type === Comment) {
      return false
    }

    if (Array.isArray(vnode.children) && !vnode.children.length) {
      return false
    }

    return (
      vnode.type !== Text
      || (
        typeof vnode.children === 'string'
        && vnode.children.trim() !== ''
      )
    )
  })
}

const showButton = computed<boolean>((): boolean => {
  const slotContent = slots.default?.(props)
  return hasSlotContent(slots.default, slotContent)
})

// dot classes
const dotClassName = ['cwa:w-[0.3rem]', 'cwa:h-[0.3rem]', 'cwa:rounded-full', 'cwa:bg-white', 'cwa:absolute', 'cwa:left-1/2', 'cwa:-translate-x-1/2']
const middleDotClassName = [...dotClassName, 'cwa:top-1/2 cwa:-translate-y-1/2']
const topDotClassName = [...dotClassName, 'cwa:top-2']
const bottomDotClassName = [...dotClassName, 'cwa:bottom-2']

const enforcedOps: PopperOptions = {
  placement: 'top-start',
  offsetDistance: 0,
}
const popperOps = computed<PopperOptions>(() => defu({}, props.popper, enforcedOps))
const [trigger, container] = usePopper(popperOps.value)
</script>

<template>
  <Popover
    v-slot="{ open }"
    class="cwa:flex cwa:gap-x-1.5 relative"
  >
    <component
      :is="to ? NuxtLink : 'button'"
      v-if="showButton"
      :to="to"
      :class="[buttonClassNames, open ? 'cwa:opacity-50' : '']"
      :disabled="loading || disabled || open"
      @click.prevent.stop="emit('click')"
    >
      <div
        v-if="loading"
        class="cwa:flex cwa:w-full cwa:justify-center"
      >
        <Spinner :show="true" />
      </div>
      <slot
        v-else
        v-bind="props"
      />
    </component>
    <template v-if="hasOptions">
      <PopoverButton
        ref="trigger"
        :class="buttonBaseClass"
        class="cwa:relative"
        :disabled="disabled || loading"
      >
        &nbsp;
        <span :class="topDotClassName" />
        <span :class="middleDotClassName" />
        <span :class="bottomDotClassName" />
      </PopoverButton>
      <PopoverPanel
        v-slot="{ close }"
        ref="container"
        class="cwa:absolute cwa:!min-w-[220px] cwa:max-w-[300px] cwa:bg-stone-700 cwa:py-1"
      >
        <template v-for="(option, index) of options">
          <ButtonPopoverGroup
            v-if="Array.isArray(option)"
            :key="`popover-group-option-${index}`"
            :options="option"
            @click="(value: ModelValue) => handleOptionClick(value, close)"
          />
          <ButtonPopoverItem
            v-else
            :key="`popover-item-option-${index}`"
            :option="option"
            @click="(value: ModelValue) => handleOptionClick(value, close)"
          />
        </template>
      </PopoverPanel>
    </template>
  </Popover>
</template>
