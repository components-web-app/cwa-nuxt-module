<template>
  <!--CWA_MANAGER_START_POSITION-->
  <ResourceLoader v-if="componentIri" ref="resourceLoader" :iri="componentIri" component-prefix="CwaComponent" />
  <ComponentPlaceholder v-else-if="$cwa.admin.isEditing" :iri="iri" />
  <!--CWA_MANAGER_END_POSITION-->
</template>

<script setup lang="ts">
import { computed, ref, toRef, watchEffect } from 'vue'
import ResourceLoader from './ResourceLoader.vue'
import ComponentPlaceholder from './ComponentPlaceholder.vue'
import { useCwa, useCwaResource, useCwaResourceManageable } from '#imports'
import type { IriProp } from '#cwa/runtime/composables/cwa-resource'
import type { ManageableResourceOps } from '#cwa/runtime/admin/manageable-resource'

const $cwa = useCwa()
const props = defineProps<IriProp>()
const resourceLoader = ref()
const resourceManagerOps: ManageableResourceOps = ref({})
const iriRef = toRef(props, 'iri')
const resource = useCwaResource(iriRef).getResource()
useCwaResourceManageable(iriRef)

const componentIri = computed(() => {
  const iri = resource.value?.data?.component
  const publishedIri = $cwa.resources.findPublishedComponentIri(iri).value
  if ($cwa.admin.isEditing) {
    const selectedEditingIri = $cwa.admin.resourceStackManager.currentIri.value
    const draftIri = $cwa.resources.findDraftComponentIri(iri).value
    if (selectedEditingIri && [draftIri, publishedIri].includes(selectedEditingIri)) {
      return selectedEditingIri
    }
    return draftIri || iri
  }
  return publishedIri
})

watchEffect(() => {
  const component = resourceLoader.value?.resourceComponent
  if (!component) {
    return
  }
  resourceManagerOps.value.styles = component.cwaResource?.styles
  resourceManagerOps.value.disabled = !!component?.disableManager
})
useCwaResourceManageable(componentIri, resourceManagerOps)
</script>
