<template>
  <PageResourceAdminModal
    :resource-type="resourceType"
    @reload="$emit('reload')"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PageResourceAdminModal from '#cwa/templates/components/core/admin/PageResourceAdminModal.vue'

defineEmits<{
  reload: []
}>()

const route = useRoute()

const resourceType = computed(() => {
  const type = String(route.params.type ?? '')
  return type.charAt(0).toUpperCase() + type.slice(1)
})
</script>
