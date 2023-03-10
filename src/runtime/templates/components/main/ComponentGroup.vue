<template>
  <div v-if="showLoader" class="component-group-placeholder">
    <CwaUtilsSpinner :show="true" />
  </div>
  <template v-else-if="resource && componentPositions && componentPositions.length">
    <ResourceLoader v-for="positionIri of componentPositions" :key="`ResourceLoaderGroupPosition_${resource.value?.data?.['@id']}_${positionIri}`" :iri="positionIri" :ui-component="ComponentPosition" />
  </template>
  <CwaUtilsAlertInfo v-else-if="!resource">
    <p>Resource does not exist, will automatically add when logged in. Functionality coming soon</p>
  </CwaUtilsAlertInfo>
  <CwaUtilsAlertInfo v-else>
    <p>No component positions in this component group - add functionality coming soon (if logged in)</p>
  </CwaUtilsAlertInfo>
</template>

<script setup>
// todo: draggable drag and drop reordering
// todo: merge in a new component position/ component being added

import { useNuxtApp } from '#app'
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { CwaResourceTypes, getResourceTypeFromIri } from '../../../resources/resource-utils'
import { CwaResourceApiStatuses } from '../../../storage/stores/resources/state'
import ResourceLoader from '../core/ResourceLoader.vue'
import ComponentPosition from '../core/ComponentPosition.vue'

const { $cwa } = useNuxtApp()
const resourcesStore = $cwa.storage.stores.resources.useStore()
const { resourcesByType, current: { value: { byId: resources } } } = storeToRefs(resourcesStore)

const props = defineProps({
  reference: { required: true, type: String },
  location: { required: true, type: String }
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

const showLoader = computed(() => {
  return !resource.value?.data && resource.value?.apiState.status === CwaResourceApiStatuses.IN_PROGRESS && $cwa.resources.isLoading
})

const componentPositions = computed(() => {
  return resource.value?.data?.componentPositions
})

async function createComponentGroup () {
  const resourceTypeProperty = {
    [CwaResourceTypes.PAGE]: 'pages',
    [CwaResourceTypes.LAYOUT]: 'layouts',
    [CwaResourceTypes.COMPONENT]: 'components'
  }
  const locationResourceType = getResourceTypeFromIri(props.location)
  const locationProperty = resourceTypeProperty[locationResourceType]

  const postData = {
    reference: fullReference.value,
    location: props.location,
    allowedComponents: null
  }
  if (locationProperty) {
    postData[locationProperty] = [props.location]
  }
  await $cwa.resourcesManager.createResource({
    endpoint: '/_/component_groups',
    data: postData
  })
}

function updateAllowedComponents () {
  // todo
}

watch($cwa.resources.isLoading, async (isLoading) => {
  if (!isLoading) {
    // todo: check only if logged in. otherwise we are not permitted to update the API
    if (!resource.value) {
      await createComponentGroup()
    } else {
      // todo: check if current allowed components matches array
      updateAllowedComponents()
    }
  }
}, {
  immediate: true
})
</script>
