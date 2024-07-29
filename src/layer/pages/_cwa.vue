<template>
  <div class="cwa-flex cwa-flex-col cwa-h-full">
    <div class="cwa-bg-stone-800 cwa-text-white cwa-p-8 cwa-grow">
      <NuxtPage />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useHead } from '#app'
import { definePageMeta } from '#imports'

definePageMeta({
  cwa: false,
  cwa_admin: true,
  layout: 'cwa-root-layout'
})
useHead({
  bodyAttrs: {
    class: 'cwa-bg-stone-800'
  }
})
</script>
