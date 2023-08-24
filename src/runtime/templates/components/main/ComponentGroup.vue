<template>
  <div v-if="showLoader" class="component-group-placeholder">
    <CwaUiSpinner :show="true" />
  </div>
  <template v-else-if="componentPositions?.length">
    <ResourceLoader v-for="positionIri of componentPositions" :key="getResourceKey(positionIri)" :iri="positionIri" :ui-component="ComponentPosition" />
    <!--CWA_MANAGER_END-->
  </template>
  <div v-else-if="signedInAndResourceExists" class="cwa-flex cwa-justify-center cwa-border-2 cwa-border-dashed cwa-border-gray-200 cwa-p-5">
    <CwaUiHotSpot screen-reader-action="Add component position" />
  </div>
</template>

<script setup lang="ts">
// Comments around the resource loaders is to allow component groups not to need to be wrapped in a dev and so we know when one cg ends

// todo: draggable drag and drop reordering
// todo: merge in a new component position/ component being added

import { computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { ComponentGroupUtilSynchronizer } from '#cwa/runtime/templates/components/main/ComponentGroup.Util.Synchronizer'
import ComponentPosition from '#cwa/runtime/templates/components/core/ComponentPosition'
import ResourceLoader from '#cwa/runtime/templates/components/core/ResourceLoader'
import { CwaResourceApiStatuses } from '#cwa/runtime/storage/stores/resources/state'
import { useCwa, useCwaResourceManageable } from '#imports'

const $cwa = useCwa()
const $manager = useCwaResourceManageable()

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
  return $cwa.auth.signedIn.value && !!resource.value?.data && $cwa.admin.isEditing
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
  componentGroupSynchronizer.createSyncWatcher({
    resource,
    location: props.location,
    fullReference,
    allowedComponents: props.allowedComponents
  })

  // initialise the manager when we know what the component group iri is
  if ($manager) {
    watch(resource, $manager.resourceWatchHandler, {
      immediate: true,
      flush: 'post'
    })
  }
})

onBeforeUnmount(() => {
  componentGroupSynchronizer.stopSyncWatcher()
})
</script>
