<template>
  <div v-if="showLoader" class="component-group-placeholder">
    <CwaUtilsSpinner :show="true" />
  </div>
  <template v-else-if="componentPositions">
    <ResourceLoader v-for="positionIri of componentPositions" :key="`ResourceLoaderGroupPosition_${resource.value?.data?.['@id']}_${positionIri}`" :iri="positionIri" :ui-component="ComponentPosition" />
  </template>
  <CwaUtilsAlertInfo v-else>
    <p>No component positions in this component group - add functionality coming soon</p>
  </CwaUtilsAlertInfo>
</template>

<script setup>
import { useNuxtApp } from '#app'
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import consola from 'consola'
import { CwaResourceTypes } from '../../../resources/resource-utils'
import { CwaResourceApiStatuses } from '../../../storage/stores/resources/state'
import ResourceLoader from '../core/ResourceLoader.vue'
import ComponentPosition from '../core/ComponentPosition.vue'

const { $cwa } = useNuxtApp()

const props = defineProps({
  reference: { required: true, type: String },
  location: { required: true, type: String }
})

const resourcesStore = $cwa.storage.stores.resources.useStore()
const { resourcesByType, current: { value: { byId: resources } } } = storeToRefs(resourcesStore)

const resource = computed(() => {
  const componentGroups = resourcesByType.value[CwaResourceTypes.COMPONENT_GROUP]
  const locationResource = resources[props.location]
  if (!locationResource) {
    return
  }
  const locationResourceReference = locationResource.data?.reference
  const fullReference = `${props.reference}_${locationResourceReference}`
  return componentGroups.find((componentGroupResource) => {
    return componentGroupResource.data?.reference === fullReference
  })
})

const showLoader = computed(() => {
  return resource.value?.apiState.status === CwaResourceApiStatuses.IN_PROGRESS || !resource.value
})

const componentPositions = computed(() => {
  return resource.value?.data?.componentPositions
})

// todo: ensure the allowed components configured matches in the API
// todo: draggable drag and drop reordering
// todo: merge in a new component position/ component being added

watch($cwa.resourcesManager.isLoading, (isLoading) => {
  if (!isLoading && !resource.value) {
    // todo: create component group
    consola.warn('TODO: NO COMPONENT GROUP FOUND - CREATE IT')
  }
}, {
  immediate: true
})
</script>
