<template>
  <div
    v-if="showLoader"
    class="component-group-placeholder"
  >
    <Spinner :show="true" />
  </div>
  <template v-else-if="componentPositions?.length">
    <!--cwa-start-->
    <ResourceLoader
      v-for="positionIri of componentPositions"
      :key="getResourceKey(positionIri)"
      :data-sort-value="$cwa.resources.getPositionSortDisplayNumber(positionIri)"
      :iri="positionIri"
      :ui-component="ComponentPosition"
      :class="nestedClasses"
    />
    <!--cwa-end-->
  </template>
  <template v-else-if="isNewPosition">
    <!--cwa-start-->
    <div class="cwa:flex cwa:justify-center cwa:border-2 cwa:border-dashed cwa:border-gray-200 cwa:p-5 cwa:pb-14 cwa:relative">
      <LazyHotSpot
        screen-reader-action="Add component position"
        :iri="iri"
        disabled
      />
      <span class="cwa:absolute cwa:bg-stone-600 cwa:text-light cwa:text-sm cwa:px-3 cwa:py-0.5 cwa:rounded-full cwa:bottom-5">
        Add the component to populate this component group
      </span>
    </div>
    <!--cwa-end-->
  </template>
  <template v-else-if="hasLocation && !locationResource && !$cwa.resources.isLoading.value">
    <!--cwa-start-->
    <div>
      <CwaUiAlertWarning>
        The location provided `{{ location }}` is not a current resource
      </CwaUiAlertWarning>
    </div>
    <!--cwa-end-->
  </template>
  <template v-else-if="signedInAndResourceExists">
    <!--cwa-start-->
    <div class="cwa:flex cwa:justify-center cwa:border-2 cwa:border-dashed cwa:border-gray-200 cwa:p-5 cwa:relative">
      <LazyHotSpot
        screen-reader-action="Add component position"
        :iri="iri"
        :disabled="!iri || $cwa.admin.resourceStackManager.isComponentGroupDisabled(iri, location)"
      />
    </div>
    <!--cwa-end-->
  </template>
</template>

<script setup lang="ts">
// Comments around the resource loaders is to allow component groups not to need to be wrapped in a dev and so we know when one cg ends
import {
  computed,
  onMounted,
  onBeforeUnmount,
  defineAsyncComponent,
  watch,
} from 'vue'
import { ComponentGroupUtilSynchronizer } from '#cwa/templates/components/main/ComponentGroup.Util.Synchronizer'
import {
  useComponentGroupPositions,
} from '#cwa/templates/components/main/ComponentGroup.Util.Positions'
import {
  useComponentGroupEvents,
} from '#cwa/templates/components/main/ComponentGroup.Util.Events'
import type { CwaComponentGroupPair } from '#cwa/templates/components/main/ComponentGroup.Util.Events'
import ComponentPosition from '#cwa/templates/components/core/ComponentPosition.vue'
import ResourceLoader from '#cwa/templates/components/core/ResourceLoader.vue'
import { CwaResourceApiStatuses, NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'
import { useCwa } from '#cwa/composables/cwa'
import { useCwaResourceManageable } from '#cwa/composables/cwa-resource-manageable'
import Spinner from '#cwa/templates/components/utils/Spinner.vue'

const LazyHotSpot = defineAsyncComponent({
  suspensible: false,
  loader: () => import('#cwa/templates/components/utils/HotSpot.vue'),
})

const iri = computed<string | undefined>(() => resource.value?.data?.['@id'])
const $cwa = useCwa()

useCwaResourceManageable(iri)

type PropsType = { reference: string, locationReference?: string, location?: string, allowedComponents?: string[] | null }
const props = withDefaults(defineProps<PropsType>(), { allowedComponents: null })

// `location` is usually a resource IRI which is undefined until its resource resolves - e.g.
// `$cwa.resources.layoutIri.value` in a layout. Until we have one there is nothing to render and
// nothing to warn about. A location which IS provided but does not resolve still shows the warning.
const hasLocation = computed(() => props.location !== undefined)

const emit = defineEmits<{
  componentsLoaded: [pairs: CwaComponentGroupPair[]]
  componentsUpdated: [pairs: CwaComponentGroupPair[]]
}>()

const locationResource = computed(() => {
  if (props.location === undefined) {
    return
  }
  return $cwa.resources.getResource(props.location).value
})

const fullReference = computed(() => {
  // do not use reference as configured by the user as this can change, so use IRI as reference here
  // const locationResourceReference = locationResource.value.data?.reference
  return `${props.reference}_${props.locationReference || props.location}`
})

const resource = computed(() => {
  return $cwa.resources.getComponentGroupByReference(fullReference.value)
})

const signedInAndResourceExists = computed(() => {
  return $cwa.auth.signedIn.value && !!resource.value?.data && $cwa.admin.isEditing
})

const showLoader = computed(() => {
  // without a location we do not know what we are waiting for - render nothing at all
  if (!hasLocation.value) {
    return false
  }
  // is the whole resource chain loading is not loading, do not show the group as loading
  if (!$cwa.resources.isLoading.value) {
    return false
  }
  // if the resource has not been initialised yet, show the loader
  if (!resource.value) {
    return true
  }
  // if we do not have data yet (nothing cached either) and the api fetch status is in progress
  return !resource.value?.data && resource.value?.apiState?.status === CwaResourceApiStatuses.IN_PROGRESS
})

const componentGroupSynchronizer = new ComponentGroupUtilSynchronizer()

const { groupIsReordering, componentPositions } = useComponentGroupPositions(iri, $cwa)

useComponentGroupEvents(componentPositions, $cwa, {
  onLoaded: pairs => emit('componentsLoaded', pairs),
  onUpdated: pairs => emit('componentsUpdated', pairs),
})

const nestedClasses = computed(() => {
  if (!groupIsReordering.value) {
    return
  }
  return ['cwa:is-reordering']
})

const isNewPosition = computed(() => {
  return props.location === NEW_RESOURCE_IRI
})

function getResourceKey(positionIri: string) {
  return `ResourceLoaderGroupPosition_${iri.value}_${positionIri}`
}

let syncWatcherStarted = false

onMounted(() => {
  if (isNewPosition.value) {
    return
  }
  // the location may not be resolved when we mount - the synchronizer needs a real location to
  // create or attach a component group, so start it as soon as one is available
  watch(() => props.location, (location) => {
    if (syncWatcherStarted || location === undefined) {
      return
    }
    syncWatcherStarted = true
    componentGroupSynchronizer.createSyncWatcher({
      resource,
      location,
      fullReference,
      allowedComponents: props.allowedComponents,
    })
  }, { immediate: true })
})

onBeforeUnmount(() => {
  componentGroupSynchronizer.stopSyncWatcher()
})

defineExpose({
  componentPositions,
})
</script>
