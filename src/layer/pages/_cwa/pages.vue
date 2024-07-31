<template>
  <ListHeading title="Pages" />
</template>

<script lang="ts" setup>
import { useHead } from '#app'
import ListHeading from '#cwa/runtime/templates/components/core/admin/ListHeading.vue'

useHead({
  title: 'Pages'
})
</script>
