<template>
  <PageAdminModal @reload="$emit('reload')" />
</template>

<script lang="ts" setup>
import PageAdminModal from '#cwa/runtime/templates/components/core/admin/PageAdminModal.vue'
import { definePageMeta } from '#imports'

definePageMeta({
  name: '_cwa-pages-iri',
})

defineEmits<{
  reload: []
}>()
</script>
