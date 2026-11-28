<template>
  <CwaLink
    v-if="to"
    :to="to"
    :class="linkClass"
  >
    <slot />
  </CwaLink>
  <button
    v-else
    type="button"
    :class="linkClass"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

defineProps<{
  to?: RouteLocationRaw
}>()

defineSlots<{
  default(): any
}>()

const linkClass = 'cwa:inline-flex cwa:items-center cwa:pointer-coarse:min-h-hit cwa:transition cwa:font-medium cwa:text-neutral-400 cwa:hover:text-white cwa:outline-1 cwa:outline-transparent cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg'
</script>
