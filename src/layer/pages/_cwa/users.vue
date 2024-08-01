<template>
  <ListHeading title="Users" />
  <ListContent fetch-url="/users" />
</template>

<script lang="ts" setup>
import { useHead } from '#app'
import ListHeading from '#cwa/runtime/templates/components/core/admin/ListHeading.vue'
import ListContent from '#cwa/runtime/templates/components/core/admin/ListContent.vue'

useHead({
  title: 'Users'
})
</script>
