<template>
  <ListHeading title="Layouts" />
  <ListFilter />
</template>

<script lang="ts" setup>
import { useHead } from '#app'
import ListHeading from '#cwa/runtime/templates/components/core/admin/ListHeading.vue'
import ListFilter from '#cwa/runtime/templates/components/core/admin/ListFilter.vue'

useHead({
  title: 'Layouts'
})
</script>
