<template>
  <ListHeading title="Pages" />
  <ListFilter :order-options="orderOptions" :search-fields="['reference', 'title', 'uiComponent']" />
  <ListContent fetch-url="/_/pages" />
</template>

<script lang="ts" setup>
import { useHead } from '#app'
import ListHeading from '#cwa/runtime/templates/components/core/admin/ListHeading.vue'
import ListContent from '#cwa/runtime/templates/components/core/admin/ListContent.vue'
import ListFilter from '#cwa/runtime/templates/components/core/admin/ListFilter.vue'

const orderOptions = [
  {
    label: 'New - Old',
    value: { createdAt: 'desc' }
  },
  {
    label: 'Old - New',
    value: { createdAt: 'asc' }
  },
  {
    label: 'A - Z',
    value: { reference: 'asc' }
  },
  {
    label: 'Z - A',
    value: { reference: 'desc' }
  }
]

useHead({
  title: 'Pages'
})
</script>
