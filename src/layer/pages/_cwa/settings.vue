<template>
  <ListHeading
    title="Site settings"
    hide-add
  />
</template>

<script lang="ts" setup>
import { useHead } from '#app'
import ListHeading from '#cwa/runtime/templates/components/core/admin/ListHeading.vue'
import { definePageMeta } from '#imports'

useHead({
  title: 'Site Settings',
})

definePageMeta({
  name: '_cwa-settings',
  pageTransition: false,
})
</script>
