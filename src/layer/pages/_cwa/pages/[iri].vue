<template>
  <PageAdminModal @reload="$emit('reload')" />
</template>

<script lang="ts" setup>
import PageAdminModal from '#cwa/runtime/templates/components/core/admin/PageAdminModal.vue'

defineEmits<{
  reload: []
}>()
</script>
