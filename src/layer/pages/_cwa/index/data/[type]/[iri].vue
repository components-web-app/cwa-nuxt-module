<template>
  <PageResourceAdminModal
    :resource-type="dataTypeClassName || ''"
    @reload="$emit('reload')"
  />
</template>

<script lang="ts" setup>
import PageResourceAdminModal from '#cwa/templates/components/core/admin/PageResourceAdminModal.vue'
import { useDataType } from '#cwa-layer/_composables/useDataType'
import { definePageMeta } from '#imports'

const { dataTypeClassName } = useDataType()

definePageMeta({
  name: '_cwa-data-type-iri',
  key: '_cwa-data-type-iri',
})

defineEmits<{
  reload: []
}>()
</script>
