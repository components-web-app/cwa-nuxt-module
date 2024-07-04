<template>
  <div v-if="showLoader" class="component-group-placeholder">
    <Spinner :show="true" />
  </div>
  <template v-else-if="componentPositions?.length">
    <!--CWA_MANAGER_START_GROUP-->
    <ResourceLoader
      v-for="positionIri of componentPositions"
      :key="getResourceKey(positionIri)"
      :data-sort-value="getSortValue(positionIri)"
      :iri="positionIri"
      :ui-component="ComponentPosition"
      :class="nestedClasses"
    />
    <!--CWA_MANAGER_END_GROUP-->
  </template>
  <div v-else-if="signedInAndResourceExists" class="cwa-flex cwa-justify-center cwa-border-2 cwa-border-dashed cwa-border-gray-200 cwa-p-5">
    <HotSpot screen-reader-action="Add component position" :iri="iri" />
  </div>
</template>

<script setup lang="ts">
// Comments around the resource loaders is to allow component groups not to need to be wrapped in a dev and so we know when one cg ends

import {
  computed,
  onMounted,
  onBeforeUnmount, reactive
} from 'vue'
import { ComponentGroupUtilSynchronizer } from '#cwa/runtime/templates/components/main/ComponentGroup.Util.Synchronizer'
import ComponentPosition from '#cwa/runtime/templates/components/core/ComponentPosition.vue'
import ResourceLoader from '#cwa/runtime/templates/components/core/ResourceLoader.vue'
import { CwaResourceApiStatuses, NEW_RESOURCE_IRI } from '#cwa/runtime/storage/stores/resources/state'
import { useCwa } from '#cwa/runtime/composables/cwa'
import { useCwaResourceManageable } from '#cwa/runtime/composables/cwa-resource-manageable'
import Spinner from '#cwa/runtime/templates/components/utils/Spinner.vue'
import HotSpot from '#cwa/runtime/templates/components/utils/HotSpot.vue'
import { CwaResourceTypes } from '#cwa/runtime/resources/resource-utils'

type PositionSortValues = {
  [iri: string]: {
    storeValue: number|undefined
    submittingValue?: number
  }
}

const iri = computed<string|undefined>(() => resource.value?.data?.['@id'])
const $cwa = useCwa()

useCwaResourceManageable(iri)

const props = withDefaults(defineProps<{ reference: string, location: string, allowedComponents?: string[]|null }>(), { allowedComponents: null })

const groupIsReordering = computed(() => {
  if (!iri.value || !$cwa.admin.resourceStackManager.getState('reordering')) {
    return false
  }
  // look for the earliest component group and if this is the deepest nested one, we enable reordering
  return $cwa.admin.resourceStackManager.getClosestStackItemByType(CwaResourceTypes.COMPONENT_GROUP) === iri.value
})

const nestedClasses = computed(() => {
  if (!groupIsReordering.value) {
    return
  }
  return ['cwa-is-reordering']
})

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

const addingEvent = computed(() => {
  return $cwa.resourcesManager.addResourceEvent.value
})

const hasAddingPosition = computed(() => {
  return addingEvent.value?.closest.group === iri.value
})

const positionIris = computed<string[]|undefined>(() => {
  const positionIris = resource.value?.data?.componentPositions
  if (!positionIris) {
    return undefined
  }
  return positionIris
})

const positionSortValues = computed<PositionSortValues|undefined>(() => {
  const sortValues: PositionSortValues = reactive({})
  if (!positionIris.value) {
    return
  }
  for (const iri of positionIris.value) {
    sortValues[iri] = reactive({
      storeValue: computed(() => $cwa.resources.getResource(iri).value?.data?.sortValue || 0),
      submittingValue: undefined
    })
  }
  return sortValues
})

const orderedComponentPositions = computed<string[]|undefined>(() => {
  if (positionSortValues.value === undefined || positionIris.value === undefined) {
    return
  }
  const psv = positionSortValues.value
  const getSortValue = (iri: string) => {
    const sortValueData = psv[iri]
    return sortValueData.submittingValue || sortValueData.storeValue || 0
  }
  return [...positionIris.value]
    .filter(iri => psv[iri].storeValue !== undefined)
    .sort((a, b) => {
      const sortA = getSortValue(a)
      const sortB = getSortValue(b)
      return sortA === sortB ? 0 : (sortA > sortB ? 1 : -1)
    })
})

const componentPositions = computed(() => {
  const savedPositions: string[]|undefined = orderedComponentPositions.value
  if (!savedPositions) {
    return
  }
  const isInstantAdding = $cwa.resources.newResource.value?.data?._metadata?.adding?.instantAdd
  if (isInstantAdding !== false || !hasAddingPosition.value || !addingEvent.value || addingEvent.value?.addAfter === null || !$cwa.admin.isEditing) {
    return savedPositions
  }

  const placeholderNewPosition = '/_/component_positions/' + NEW_RESOURCE_IRI
  const closestPosition = addingEvent.value.closest.position

  // add new position within the current positions
  if (closestPosition) {
    const positionIndex = savedPositions.findIndex(i => (i === closestPosition))
    const newPositions = [
      ...savedPositions
    ]
    const startIndex = addingEvent.value?.addAfter ? positionIndex + 1 : positionIndex
    newPositions.splice(startIndex, 0, placeholderNewPosition)
    return newPositions
  }

  // add new position to end
  if (addingEvent.value?.addAfter) {
    return [
      ...savedPositions,
      placeholderNewPosition
    ]
  }
  // add new position to start
  return [
    placeholderNewPosition,
    ...savedPositions
  ]
})

const componentGroupSynchronizer = new ComponentGroupUtilSynchronizer()

function getResourceKey (positionIri: string) {
  return `ResourceLoaderGroupPosition_${iri.value}_${positionIri}`
}

function getSortValue (positionIri: string) {
  const storeSortValue = $cwa.resources.getResource(positionIri).value?.data?.sortValue
  return storeSortValue === undefined ? '?' : storeSortValue
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
