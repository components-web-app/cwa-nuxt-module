<template>
  <NuxtLink
    :to="to"
    class="cwa:transition cwa:font-medium cwa:text-neutral-400 cwa:hover:text-white cwa:flex cwa:gap-x-2 cwa:items-center cwa:pointer-coarse:min-h-hit cwa:outline-1 cwa:outline-transparent cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg"
  >
    <div class="cwa:w-10">
      <slot />
    </div>
    <span>
      {{ label }}
    </span>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

defineProps<{ label: string, to: RouteLocationRaw }>()

defineSlots<{
  default(): any
}>()
</script>
