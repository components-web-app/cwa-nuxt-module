<template>
  <div v-if="showLoader" class="component-group-placeholder">
    <CwaUtilsSpinner :show="true" />
  </div>
  <template v-else-if="componentPositions?.length">
    <ResourceLoader v-for="positionIri of componentPositions" :key="`ResourceLoaderGroupPosition_${resource.value?.data?.['@id']}_${positionIri}`" :iri="positionIri" :ui-component="ComponentPosition" />
  </template>
  <CwaUtilsAlertInfo v-else-if="areNoPositions">
    <p>No component positions in this component group - add functionality coming soon</p>
  </CwaUtilsAlertInfo>
</template>

<script setup lang="ts">
// todo: draggable drag and drop reordering
// todo: merge in a new component position/ component being added

import { storeToRefs } from 'pinia'
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { ComponentGroupUtilSynchronizer } from './ComponentGroup.Util.Synchronizer'
import ComponentPosition from '#cwa/runtime/templates/components/core/ComponentPosition'
import ResourceLoader from '#cwa/runtime/templates/components/core/ResourceLoader'
import { CwaResourceTypes } from '#cwa/runtime/resources/resource-utils'
import { CwaResourceApiStatuses } from '#cwa/runtime/storage/stores/resources/state'
import { useCwa } from '#imports'

const $cwa = useCwa()
const resourcesStore = $cwa.storage.stores.resources.useStore()
const { resourcesByType, current: { value: { byId: resources } } } = storeToRefs(resourcesStore)

const props = defineProps({
  reference: { required: true, type: String },
  location: { required: true, type: String },
  allowedComponents: { required: false, type: Array, default () { return null } }
})

const fullReference = computed(() => {
  const locationResource = resources[props.location]
  if (!locationResource) {
    return
  }
  const locationResourceReference = locationResource.data?.reference
  return `${props.reference}_${locationResourceReference}`
})

const resource = computed(() => {
  const componentGroups = resourcesByType.value[CwaResourceTypes.COMPONENT_GROUP]
  return componentGroups.find((componentGroupResource) => {
    return componentGroupResource.data?.reference === fullReference.value
  })
})

const areNoPositions = computed(() => {
  return $cwa.auth.signedIn.value && !!resource.value
})

const showLoader = computed(() => {
  return $cwa.resources.isLoading.value && (!resource.value || (!resource.value?.data && resource.value?.apiState.status === CwaResourceApiStatuses.IN_PROGRESS))
})

const componentPositions = computed(() => {
  return resource.value?.data?.componentPositions
})

const componentGroupSynchroniser = new ComponentGroupUtilSynchronizer()

onMounted(() => {
  componentGroupSynchroniser.createSyncWatcher(
    resource,
    props.location,
    fullReference,
    props.allowedComponents
  )
})

onBeforeUnmount(() => {
  componentGroupSynchroniser.stopSyncWatcher()
})
</script>
