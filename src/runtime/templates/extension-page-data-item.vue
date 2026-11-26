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
import { useCwa } from '#cwa/composables/cwa'

defineEmits<{
  reload: []
}>()

const $cwa = useCwa()
const route = useRoute()

const resourceType = computed(() => {
  const iri = Array.isArray(route.params.iri) ? route.params.iri[0] : route.params.iri
  return iri ? $cwa.resources.getResource(iri).value?.data?.['@type'] : undefined
})
</script>
