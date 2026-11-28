<template>
  <li
    class="cwa:relative cwa:flex cwa:min-h-16 cwa:items-center cwa:gap-4 cwa:border-b cwa:border-line cwa:px-4 cwa:py-2.5"
    :class="{ 'cwa:hover:bg-field-hover/50': interactive }"
  >
    <span
      v-if="$slots.icon"
      aria-hidden="true"
      data-testid="dashboard-row-icon"
      class="cwa:flex cwa:size-6 cwa:shrink-0 cwa:items-center cwa:justify-center cwa:text-fg-muted cwa:[&>svg]:max-h-full cwa:[&>svg]:max-w-full"
    >
      <slot name="icon" />
    </span>
    <span class="cwa:flex cwa:min-w-0 cwa:flex-col cwa:gap-0.5">
      <NuxtLink
        v-if="to"
        :to="to"
        :aria-describedby="describedBy"
        :class="controlClass"
      >{{ label }}</NuxtLink>
      <button
        v-else-if="button"
        type="button"
        :aria-describedby="describedBy"
        :class="[controlClass, 'cwa:cursor-pointer cwa:border-0 cwa:bg-transparent cwa:p-0 cwa:text-start']"
        @click="emit('select')"
      >
        {{ label }}
      </button>
      <span
        v-else
        data-testid="dashboard-row-label"
        class="cwa:truncate cwa:text-control cwa:font-medium cwa:text-fg"
      >{{ label }}</span>
      <span
        v-if="description"
        :id="descriptionId"
        class="cwa:text-helper cwa:text-fg-muted"
      >{{ description }}</span>
    </span>
  </li>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

const { label, to, description, button = false } = defineProps<{
  label: string
  to?: RouteLocationRaw
  description?: string
  button?: boolean
}>()

const emit = defineEmits<{
  select: []
}>()

defineSlots<{
  icon?: () => unknown
}>()

const descriptionId = useId()
const describedBy = computed(() => description ? descriptionId : undefined)
const interactive = computed(() => !!to || button)

const controlClass = 'cwa:truncate cwa:text-control cwa:font-medium cwa:text-fg cwa:outline-1 cwa:outline-transparent cwa:after:absolute cwa:after:inset-0 cwa:after:content-[\'\'] cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg'
</script>
