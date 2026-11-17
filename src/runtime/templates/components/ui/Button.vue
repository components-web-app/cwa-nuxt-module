<script setup lang="ts">
import { computed, useId } from 'vue'
import type { Component } from 'vue'
import Spinner from './Spinner.vue'
import { buttonLooks } from './kit-looks'
import type { ButtonTone, ButtonVariant } from './kit-looks'

const {
  label,
  variant = 'soft',
  tone = 'accent',
  size = 'md',
  icon,
  iconOnly = false,
  loading = false,
  disabled = false,
  disabledReason,
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
  disabledReason?: string
  type?: 'button' | 'submit' | 'reset'
}>()

const emit = defineEmits<{ click: [event: MouseEvent] }>()

const inactive = computed(() => loading || disabled)

const reason = computed(() => disabled ? disabledReason : undefined)

const reasonId = useId()

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
  const look = buttonLooks[variant][tone]
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
    :aria-describedby="reason ? reasonId : undefined"
    :title="reason"
    class="cwa:inline-flex cwa:shrink-0 cwa:items-center cwa:justify-center cwa:gap-2 cwa:whitespace-nowrap cwa:font-semibold cwa:leading-5 cwa:transition-colors cwa:duration-(--cwa-duration-fast) cwa:ease-out cwa:motion-reduce:transition-none cwa:outline-1 cwa:outline-transparent cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg"
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
    <span
      v-if="reason"
      :id="reasonId"
      aria-hidden="true"
      class="cwa:sr-only"
    >{{ reason }}</span>
  </button>
</template>
