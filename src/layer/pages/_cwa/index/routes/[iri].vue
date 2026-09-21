<template>
  <PageResourceAdminModal :resource-type="resourceType" />
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PageResourceAdminModal from '#cwa/templates/components/core/admin/PageResourceAdminModal.vue'
import { definePageMeta } from '#imports'
import { CwaResourceTypes, getResourceTypeFromIri } from '#cwa/resources/resource-utils'

const route = useRoute()

const resourceType = computed(() => {
  const iri = Array.isArray(route.params.iri) ? route.params.iri[0] : route.params.iri
  return getResourceTypeFromIri(iri || '') === CwaResourceTypes.PAGE ? 'Page' : 'PageData'
})

definePageMeta({
  name: '_cwa-routes-iri',
})
</script>
