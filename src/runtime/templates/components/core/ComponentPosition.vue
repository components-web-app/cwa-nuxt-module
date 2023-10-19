<template>
  <!--CWA_MANAGER_START_POSITION-->
  <ResourceLoader v-if="componentIri" :iri="componentIri" component-prefix="CwaComponent" />
  <ComponentPlaceholder v-else-if="$cwa.admin.isEditing" :iri="iri" />
  <!--CWA_MANAGER_END_POSITION-->
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import ResourceLoader from './ResourceLoader.vue'
import ComponentPlaceholder from './ComponentPlaceholder.vue'
import { useCwa, useCwaResource } from '#imports'
import { IriProp } from '#cwa/runtime/composables/cwa-resource'

const $cwa = useCwa()
const props = defineProps<IriProp>()

const resource = useCwaResource(toRef(props, 'iri')).getResource()
const componentIri = computed(() => {
  const iri = resource.value?.data?.component
  if ($cwa.admin.isEditing) {
    return $cwa.resources.findDraftComponentIri(iri).value || iri
  }
  return $cwa.resources.findPublishedComponentIri(iri).value
})
</script>
