<template>
  <div class="cwa-flex cwa-flex-col cwa-h-full">
    <div class="cwa-bg-stone-800 cwa-text-white cwa-p-8 cwa-grow">
      <NuxtPage />
    </div>
    <div class="cwa-text-stone-600 p-6 cwa-flex cwa-justify-center">
      <NuxtLink to="https://cwa.rocks" target="_blank" rel="noopener">
        <CwaLogo class="cwa-h-5 cwa-w-auto" /><span class="cwa-sr-only">Components Web App</span>
      </NuxtLink>
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
