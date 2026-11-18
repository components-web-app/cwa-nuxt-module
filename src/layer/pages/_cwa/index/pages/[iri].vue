<template>
  <PageResourceAdminModal
    resource-type="Page"
    @reload="$emit('reload')"
  />
</template>

<script lang="ts" setup>
import PageResourceAdminModal from '#cwa/templates/components/core/admin/PageResourceAdminModal.vue'
import { definePageMeta } from '#imports'

definePageMeta({
  name: '_cwa-pages-iri',
  key: '_cwa-pages-iri',
})

defineEmits<{
  reload: []
}>()
</script>
