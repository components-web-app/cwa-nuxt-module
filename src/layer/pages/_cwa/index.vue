<template>
  <div class="cwa:flex cwa:flex-col cwa:h-full cwa:max-sm:pb-[calc(var(--cwa-spacing-hit)+1px+env(safe-area-inset-bottom))]">
    <div class="cwa:bg-stone-800 cwa:text-white cwa:grow">
      <NuxtPage />
    </div>
    <div class="cwa:text-stone-600 cwa:p-6 cwa:flex cwa:justify-center">
      <NuxtLink
        to="https://cwa.rocks"
        target="_blank"
        rel="noopener"
      >
        <CwaLogo class="cwa:h-5 cwa:w-auto" /><span class="cwa:sr-only">Components Web App</span>
      </NuxtLink>
    </div>
    <BottomBar />
  </div>
</template>

<script lang="ts" setup>
import { definePageMeta, useHead } from '#imports'
import cwaAdmin from '#cwa-layer/middleware/cwa-admin'
import BottomBar from '#cwa/templates/components/main/admin/header/_parts/BottomBar.vue'

definePageMeta({
  middleware: cwaAdmin,
  cwa: {
    disabled: true,
    admin: true,
  },
  layout: 'cwa-root-layout',
})

useHead({
  bodyAttrs: {
    class: 'cwa:bg-stone-800',
  },
})
</script>
