<script setup lang="ts">
import { definePageMeta } from '#imports'
import CwaPage from '#cwa/runtime/templates/cwa-page.vue'
// @ts-expect-error-next-line
import { options } from '#build/cwa-options'

definePageMeta({
  name: '_cwa-resource-page',
  cwa: {
    disabled: false,
    admin: false,
  },
  layout: options.layoutName || 'cwa-root-layout',
})
</script>

<template>
  <CwaPage v-bind="$props" />
</template>
