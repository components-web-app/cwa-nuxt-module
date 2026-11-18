<script setup lang="ts">
import { computed, defineAsyncComponent, ref, useId, useTemplateRef, watch } from 'vue'
import type { Component } from 'vue'
import Spinner from './Spinner.vue'
import Menu from './Menu.vue'
import type { MenuEntry, MenuItem } from '../core/ui/menu-entries'
import { buttonLooks } from './kit-looks'
import type { ButtonTone, ButtonVariant } from './kit-looks'

const {
  label,
  shortLabel,
  variant = 'soft',
  tone = 'accent',
  size = 'md',
  icon,
  iconOnly = false,
  loading = false,
  disabled = false,
  disabledReason,
  type = 'button',
  options,
  optionsLabel = 'More actions',
  ariaLabel,
  stretch = false,
} = defineProps<{
  label?: string
  shortLabel?: string
  variant?: ButtonVariant
  tone?: ButtonTone
  size?: 'sm' | 'md'
  icon?: Component
  iconOnly?: boolean
  loading?: boolean
  disabled?: boolean
  disabledReason?: string
  type?: 'button' | 'submit' | 'reset'
  options?: MenuEntry[]
  optionsLabel?: string
  ariaLabel?: string
  stretch?: boolean
}>()

const ReasonPopover = defineAsyncComponent(() => import('../core/ui/ReasonPopover.vue'))

const emit = defineEmits<{ click: [event: MouseEvent], select: [item: MenuItem] }>()

const split = useTemplateRef<HTMLElement>('split')
const button = useTemplateRef<HTMLElement>('button')

const inactive = computed(() => loading || disabled)

const reason = computed(() => disabled ? disabledReason : undefined)

const reasonId = useId()

const reasonShown = ref(false)
watch(reason, now => now || (reasonShown.value = false))

const hasLead = computed(() => loading || !!icon)

const boxClasses = computed(() => {
  const small = size === 'sm'
  if (iconOnly) {
    return small ? 'cwa:h-8 cwa:w-8 cwa:pointer-coarse:h-hit cwa:pointer-coarse:w-hit cwa:px-0' : 'cwa:h-control cwa:w-control cwa:px-0'
  }
  const height = stretch ? 'cwa:h-full' : small ? 'cwa:h-8 cwa:pointer-coarse:h-hit' : 'cwa:h-control'
  const padding = small ? 'cwa:px-3' : (hasLead.value ? 'cwa:pl-3 cwa:pr-4' : 'cwa:px-4')
  return `${height} ${padding}`
})

const moreVariant = computed<ButtonVariant>(() => label ? variant : 'soft')

const moreClasses = computed(() => {
  const look = buttonLooks[moreVariant.value][tone]
  const box = stretch ? 'cwa:h-full cwa:aspect-square' : size === 'sm' ? 'cwa:size-8 cwa:pointer-coarse:size-hit' : 'cwa:size-control cwa:pointer-coarse:size-hit'
  return [box, look.rest, 'cwa:cursor-pointer']
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
    reasonShown.value = !!reason.value
    return
  }
  emit('click', event)
}
</script>

<template>
  <div
    v-if="options"
    ref="split"
    class="cwa:inline-flex cwa:shrink-0 cwa:gap-px"
    :class="{ 'cwa:h-full': stretch }"
  >
    <Button
      v-if="label"
      :label="label"
      :short-label="shortLabel"
      :variant="variant"
      :tone="tone"
      :size="size"
      :icon="icon"
      :icon-only="iconOnly"
      :loading="loading"
      :disabled="disabled"
      :disabled-reason="disabledReason"
      :type="type"
      :aria-label="ariaLabel"
      :stretch="stretch"
      @click="emit('click', $event)"
    />
    <Menu
      :items="options"
      :label="optionsLabel"
      :at="split"
      @select="emit('select', $event)"
    >
      <button
        type="button"
        data-testid="button-options"
        :aria-label="optionsLabel"
        :disabled="loading"
        class="cwa:inline-flex cwa:shrink-0 cwa:items-center cwa:justify-center cwa:outline-1 cwa:outline-transparent cwa:transition-colors cwa:duration-(--cwa-duration-fast) cwa:ease-out cwa:motion-reduce:transition-none cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg cwa:disabled:cursor-progress cwa:disabled:opacity-50"
        :class="[moreClasses, loading ? '' : buttonLooks[moreVariant][tone].hover]"
      >
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          fill="currentColor"
          class="cwa:size-4"
        ><circle
          cx="8"
          cy="3"
          r="1.6"
        /><circle
          cx="8"
          cy="8"
          r="1.6"
        /><circle
          cx="8"
          cy="13"
          r="1.6"
        /></svg>
      </button>
    </Menu>
  </div>
  <button
    v-else
    ref="button"
    :type="type"
    :aria-label="iconOnly ? label : ariaLabel"
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
    <template v-if="!iconOnly && shortLabel">
      <span
        class="cwa:min-w-0 cwa:sm:hidden"
        data-testid="button-short-label"
      >{{ shortLabel }}</span>
      <span class="cwa:hidden cwa:min-w-0 cwa:sm:inline">{{ label }}</span>
    </template>
    <span
      v-else-if="!iconOnly"
      class="cwa:min-w-0"
    >{{ label }}</span>
    <span
      v-if="reason"
      :id="reasonId"
      aria-hidden="true"
      class="cwa:sr-only"
    >{{ reason }}</span>
    <ReasonPopover
      v-if="reasonShown && reason && button"
      :anchor="button"
      :label="`Why ${label ?? ariaLabel} is unavailable`"
      :text="reason"
      @close="reasonShown = false"
    />
  </button>
</template>
