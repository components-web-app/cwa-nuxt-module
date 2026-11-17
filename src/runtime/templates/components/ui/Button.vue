<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import Spinner from './Spinner.vue'

type ButtonVariant = 'solid' | 'soft' | 'ghost'
type ButtonTone = 'accent' | 'danger'

const {
  label,
  variant = 'soft',
  tone = 'accent',
  size = 'md',
  icon,
  iconOnly = false,
  loading = false,
  disabled = false,
  type = 'button',
} = defineProps<{
  label: string
  variant?: ButtonVariant
  tone?: ButtonTone
  size?: 'sm' | 'md'
  icon?: Component
  iconOnly?: boolean
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}>()

const emit = defineEmits<{ click: [event: MouseEvent] }>()

const looks: Record<ButtonVariant, Record<ButtonTone, { rest: string, hover: string }>> = {
  solid: {
    accent: { rest: 'cwa:bg-accent cwa:text-white', hover: 'cwa:hover:bg-accent-hover' },
    danger: { rest: 'cwa:bg-danger-fill cwa:text-white', hover: 'cwa:hover:bg-danger-fill-hover' },
  },
  soft: {
    accent: { rest: 'cwa:bg-button cwa:text-fg', hover: 'cwa:hover:bg-field-hover' },
    danger: { rest: 'cwa:bg-button cwa:text-danger-fg', hover: 'cwa:hover:bg-field-danger cwa:hover:text-fg' },
  },
  ghost: {
    accent: { rest: 'cwa:bg-transparent cwa:text-fg', hover: 'cwa:hover:bg-button' },
    danger: { rest: 'cwa:bg-transparent cwa:text-danger-fg', hover: 'cwa:hover:bg-button' },
  },
}

const inactive = computed(() => loading || disabled)

const hasLead = computed(() => loading || !!icon)

const boxClasses = computed(() => {
  const small = size === 'sm'
  if (iconOnly) {
    return small ? 'cwa:h-8 cwa:w-8 cwa:pointer-coarse:h-hit cwa:pointer-coarse:w-hit cwa:px-0' : 'cwa:h-control cwa:w-control cwa:px-0'
  }
  const height = small ? 'cwa:h-8 cwa:pointer-coarse:h-hit' : 'cwa:h-control'
  const padding = small ? 'cwa:px-3' : (hasLead.value ? 'cwa:pl-3 cwa:pr-4' : 'cwa:px-4')
  return `${height} ${padding}`
})

const classes = computed(() => {
  const look = looks[variant][tone]
  return [
    boxClasses.value,
    size === 'sm' ? 'cwa:text-helper' : 'cwa:text-label',
    look.rest,
    inactive.value ? '' : look.hover,
    disabled ? 'cwa:opacity-50 cwa:cursor-not-allowed' : loading ? 'cwa:cursor-progress' : 'cwa:cursor-pointer',
  ]
})

function onClick(event: MouseEvent) {
  if (inactive.value) {
    event.preventDefault()
    return
  }
  emit('click', event)
}
</script>

<template>
  <button
    :type="type"
    :aria-label="iconOnly ? label : undefined"
    :aria-disabled="inactive ? 'true' : undefined"
    :aria-busy="loading ? 'true' : undefined"
    class="cwa:inline-flex cwa:shrink-0 cwa:items-center cwa:justify-center cwa:gap-2 cwa:whitespace-nowrap cwa:font-semibold cwa:leading-5 cwa:transition-colors cwa:duration-(--cwa-duration-fast) cwa:ease-out cwa:reduced-motion:transition-none cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg"
    :class="classes"
    @click="onClick"
  >
    <Spinner
      v-if="loading"
      :size="size === 'sm' ? 'sm' : 'md'"
    />
    <component
      :is="icon"
      v-else-if="icon"
      aria-hidden="true"
      class="cwa:size-4 cwa:shrink-0"
    />
    <span
      v-if="!iconOnly"
      class="cwa:min-w-0"
    >{{ label }}</span>
  </button>
</template>
