<template>
  <NuxtPage />
</template>

<script lang="ts" setup>
import { definePageMeta } from '#imports'

definePageMeta({
  cwa: false,
  cwa_admin: true,
  layout: 'cwa-root-layout'
})
</script>
