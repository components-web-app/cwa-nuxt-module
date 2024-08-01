<template>
  <ListHeading title="Pages" />
  <ListContent fetch-url="/_/pages" />
</template>

<script lang="ts" setup>
import { useHead } from '#app'
import ListHeading from '#cwa/runtime/templates/components/core/admin/ListHeading.vue'
import ListContent from '#cwa/runtime/templates/components/core/admin/ListContent.vue'

useHead({
  title: 'Pages'
})
</script>
