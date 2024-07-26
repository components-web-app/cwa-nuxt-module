<template>
  <NuxtLink :to="to || '#'" class="cwa-font-medium cwa-text-neutral-400 hover:cwa-text-white">
    <slot />
  </NuxtLink>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

defineProps<{
  to?: RouteLocationRaw
}>()
</script>
