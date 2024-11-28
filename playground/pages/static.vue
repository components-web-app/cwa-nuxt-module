<script lang="ts" setup>
import { definePageMeta } from '#imports'

definePageMeta({
  layout: 'cwa-root-layout',
  cwa: {
    disabled: true,
    staticLayout: 'CwaLayoutPrimary',
  },
})
</script>

<template>
  <div class="text-white">
    My Static Page
  </div>
</template>
