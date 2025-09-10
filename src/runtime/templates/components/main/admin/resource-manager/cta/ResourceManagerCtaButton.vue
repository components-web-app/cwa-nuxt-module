<template>
  <template v-if="isAddingNew">
    <NewResourceCta
      v-if="resource && currentIri"
      :current-iri="currentIri"
      :resource="resource"
    />
  </template>
  <CurrentResourceCta
    v-else-if="resource && currentIri"
    :current-iri="currentIri"
    :resource="resource"
  />
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useCwa } from '#cwa/composables/cwa'
import { NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'
import NewResourceCta from '#cwa/templates/components/main/admin/resource-manager/cta/NewResourceCta.vue'
import CurrentResourceCta
  from '#cwa/templates/components/main/admin/resource-manager/cta/CurrentResourceCta.vue'

const $cwa = useCwa()
const currentIri = $cwa.admin.resourceStackManager.currentIri

const isAddingNew = computed(() => {
  return currentIri.value === NEW_RESOURCE_IRI
})

const resource = computed(() => (currentIri.value ? $cwa.resources.getResource(currentIri.value).value?.data : undefined))
</script>
