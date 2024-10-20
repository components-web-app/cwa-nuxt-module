<template>
  <PageDataAdminModal
    :resource-type="dataTypeClassName || ''"
    @reload="$emit('reload')"
  />
</template>

<script lang="ts" setup>
import PageDataAdminModal from '#cwa/runtime/templates/components/core/admin/PageDataAdminModal.vue'
import { useDataType } from '#cwa/layer/pages/_cwa/composables/useDataType'

const { dataTypeClassName } = useDataType()

defineEmits<{
  reload: []
}>()
</script>
