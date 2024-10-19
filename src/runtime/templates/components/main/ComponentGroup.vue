<template>
  <div v-if="showLoader" class="component-group-placeholder">
    <Spinner :show="true" />
  </div>
  <template v-else-if="componentPositions?.length">
    <!--CWA_MANAGER_START_GROUP-->
    <ResourceLoader
      v-for="positionIri of componentPositions"
      :key="getResourceKey(positionIri)"
      :data-sort-value="$cwa.resources.getPositionSortDisplayNumber(positionIri)"
      :iri="positionIri"
      :ui-component="ComponentPosition"
      :class="nestedClasses"
    />
    <!--CWA_MANAGER_END_GROUP-->
  </template>
  <div v-else-if="signedInAndResourceExists" class="cwa-flex cwa-justify-center cwa-border-2 cwa-border-dashed cwa-border-gray-200 cwa-p-5">
    <LazyHotSpot screen-reader-action="Add component position" :iri="iri" />
  </div>
</template>

<script setup lang="ts">
// Comments around the resource loaders is to allow component groups not to need to be wrapped in a dev and so we know when one cg ends

import {
  computed,
  onMounted,
  onBeforeUnmount,
  defineAsyncComponent
} from 'vue'
import { ComponentGroupUtilSynchronizer } from '#cwa/runtime/templates/components/main/ComponentGroup.Util.Synchronizer'
import {
  useComponentGroupPositions
} from '#cwa/runtime/templates/components/main/ComponentGroup.Util.Positions'
import ComponentPosition from '#cwa/runtime/templates/components/core/ComponentPosition.vue'
import ResourceLoader from '#cwa/runtime/templates/components/core/ResourceLoader.vue'
import { CwaResourceApiStatuses } from '#cwa/runtime/storage/stores/resources/state'
import { useCwa } from '#cwa/runtime/composables/cwa'
import { useCwaResourceManageable } from '#cwa/runtime/composables/cwa-resource-manageable'
import Spinner from '#cwa/runtime/templates/components/utils/Spinner.vue'
const LazyHotSpot = defineAsyncComponent({
  suspensible: false,
  loader: () => import('#cwa/runtime/templates/components/utils/HotSpot.vue')
})

const iri = computed<string|undefined>(() => resource.value?.data?.['@id'])
const $cwa = useCwa()

useCwaResourceManageable(iri)

const props = withDefaults(defineProps<{ reference: string, location: string, allowedComponents?: string[]|null }>(), { allowedComponents: null })

const fullReference = computed(() => {
  const locationResource = $cwa.resources.getResource(props.location)
  if (!locationResource.value) {
    return
  }
  // do not use reference as configured by the user as this can change, so use IRI as reference here
  // const locationResourceReference = locationResource.value.data?.reference
  return `${props.reference}_${props.location}`
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

const componentGroupSynchronizer = new ComponentGroupUtilSynchronizer()

const { groupIsReordering, componentPositions } = useComponentGroupPositions(iri, $cwa)

const nestedClasses = computed(() => {
  if (!groupIsReordering.value) {
    return
  }
  return ['cwa-is-reordering']
})

function getResourceKey (positionIri: string) {
  return `ResourceLoaderGroupPosition_${iri.value}_${positionIri}`
}

onMounted(() => {
  componentGroupSynchronizer.createSyncWatcher({
    resource,
    location: props.location,
    fullReference,
    allowedComponents: props.allowedComponents
  })
})

onBeforeUnmount(() => {
  componentGroupSynchronizer.stopSyncWatcher()
})
</script>
