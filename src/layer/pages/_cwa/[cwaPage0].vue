<script setup lang="ts">
import { definePageMeta } from '#imports'
import CwaPage from '#cwa/templates/cwa-page.vue'
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
