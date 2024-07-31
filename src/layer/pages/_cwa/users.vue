<template>
  <ListHeading title="Users" />
</template>

<script lang="ts" setup>
import { useHead } from '#app'
import ListHeading from '#cwa/runtime/templates/components/core/admin/ListHeading.vue'

useHead({
  title: 'Users'
})
</script>
