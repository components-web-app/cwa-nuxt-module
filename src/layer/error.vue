<script setup lang="ts">
import type { NuxtError } from '#app'

defineProps<{
  error: NuxtError
}>()
</script>

<template>
  <NuxtLayout>
    <CwaErrorPage :error="error" />
  </NuxtLayout>
</template>
