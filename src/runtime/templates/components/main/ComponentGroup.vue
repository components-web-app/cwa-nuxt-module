<template>
  <div v-if="showLoader" class="component-group-placeholder">
    <CwaUiSpinner :show="true" />
  </div>
  <template v-else-if="componentPositions?.length">
    <ResourceLoader v-for="positionIri of componentPositions" :key="getResourceKey(positionIri)" :iri="positionIri" :ui-component="ComponentPosition" />
  </template>
  <CwaUiAlertInfo v-else-if="signedInAndResourceExists">
    <p>No component positions in this component group - add functionality coming soon</p>
  </CwaUiAlertInfo>
</template>

<script setup lang="ts">
// todo: draggable drag and drop reordering
// todo: merge in a new component position/ component being added

import { computed, onMounted, onBeforeUnmount } from 'vue'
import { ComponentGroupUtilSynchronizer } from '#cwa/runtime/templates/components/main/ComponentGroup.Util.Synchronizer'
import ComponentPosition from '#cwa/runtime/templates/components/core/ComponentPosition'
import ResourceLoader from '#cwa/runtime/templates/components/core/ResourceLoader'
import { CwaResourceApiStatuses } from '#cwa/runtime/storage/stores/resources/state'
import { useCwa } from '#imports'

const $cwa = useCwa()

const props = withDefaults(defineProps<{ reference: string, location: string, allowedComponents?: string[]|null }>(), { allowedComponents: null })

const fullReference = computed(() => {
  const locationResource = $cwa.resources.getResource(props.location)
  if (!locationResource.value) {
    return
  }
  const locationResourceReference = locationResource.value.data?.reference
  return `${props.reference}_${locationResourceReference}`
})

const resource = computed(() => {
  if (!fullReference.value) {
    return
  }
  return $cwa.resources.getComponentGroupByReference(fullReference.value)
})

const signedInAndResourceExists = computed(() => {
  return $cwa.auth.signedIn.value && !!resource.value?.data
})

const showLoader = computed(() => {
  // is the whole resource chain loading is not loading, do not show the group as loading
  if (!$cwa.resources.isLoading.value) {
    return false
  }
  // if the resource has not been initialised yet, show the loader
  if (!resource.value) {
    return true
  }
  // if we do not have data yet (nothing cached either) and the api fetch status is in progress
  return !resource.value?.data && resource.value?.apiState.status === CwaResourceApiStatuses.IN_PROGRESS
})

const componentPositions = computed(() => {
  return resource.value?.data?.componentPositions
})

const componentGroupSynchronizer = new ComponentGroupUtilSynchronizer()

function getResourceKey (positionIri: string) {
  return `ResourceLoaderGroupPosition_${resource.value?.data?.['@id']}_${positionIri}`
}

onMounted(() => {
  componentGroupSynchronizer.createSyncWatcher(
    resource,
    props.location,
    fullReference,
    props.allowedComponents
  )
})

onBeforeUnmount(() => {
  componentGroupSynchronizer.stopSyncWatcher()
})
</script>
