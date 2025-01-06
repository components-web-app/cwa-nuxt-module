<template>
  <div class="cwa-flex cwa-flex-col cwa-h-full">
    <div class="cwa-bg-stone-800 cwa-text-white cwa-grow">
      <NuxtPage />
    </div>
    <div class="cwa-text-stone-600 p-6 cwa-flex cwa-justify-center">
      <NuxtLink
        to="https://cwa.rocks"
        target="_blank"
        rel="noopener"
      >
        <CwaLogo class="cwa-h-5 cwa-w-auto" /><span class="cwa-sr-only">Components Web App</span>
      </NuxtLink>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeMount } from 'vue'
import { navigateTo, useHead } from '#app'
import { definePageMeta, useCwa } from '#imports'

const $cwa = useCwa()

onBeforeMount(async () => {
  if (!$cwa.auth.isAdmin.value) {
    await navigateTo('/')
  }
})

definePageMeta({
  cwa: {
    disabled: true,
    admin: true,
  },
  layout: 'cwa-root-layout',
})
useHead({
  bodyAttrs: {
    class: 'cwa-bg-stone-800',
  },
})
</script>
