<template>
  <PageDataAdminModal
    :resource-type="dataTypeClassName || ''"
    @reload="$emit('reload')"
  />
</template>

<script lang="ts" setup>
import PageDataAdminModal from '#cwa/runtime/templates/components/core/admin/PageDataAdminModal.vue'
import { useDataType } from '#cwa/layer/pages/_cwa/index/composables/useDataType'
import { definePageMeta } from '#imports'

const { dataTypeClassName } = useDataType()

definePageMeta({
  name: '_cwa-data-type-iri',
})

defineEmits<{
  reload: []
}>()
</script>
