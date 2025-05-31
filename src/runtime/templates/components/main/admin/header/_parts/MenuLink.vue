<template>
  <CwaLink
    :to="to || '#'"
    class="cwa:transition cwa:font-medium cwa:text-neutral-400 cwa:hover:text-white"
  >
    <slot />
  </CwaLink>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

defineProps<{
  to?: RouteLocationRaw
}>()
</script>
