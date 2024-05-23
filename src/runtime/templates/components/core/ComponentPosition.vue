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
import { NEW_RESOURCE_IRI } from '#cwa/runtime/storage/stores/resources/state'

const $cwa = useCwa()
const props = defineProps<IriProp>()
const resourceLoader = ref()
const resourceManagerOps: ManageableResourceOps = ref({})
const iriRef = toRef(props, 'iri')
const resource = useCwaResource(iriRef).getResource()
useCwaResourceManageable(iriRef)

const addingEvent = computed(() => {
  return $cwa.resourcesManager.addResourceEvent.value
})

const componentIri = computed(() => {
  const newResource = $cwa.resources.getResource(NEW_RESOURCE_IRI)
  if (addingEvent.value?.targetIri === props.iri && addingEvent.value?.addAfter === null && newResource.value) {
    return NEW_RESOURCE_IRI
  }
  const iri = resource.value?.data?.component
  if (iri === NEW_RESOURCE_IRI) {
    return iri
  }
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
