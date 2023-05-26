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

<script setup>
// todo: draggable drag and drop reordering
// todo: merge in a new component position/ component being added

import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import _isEqual from 'lodash/isEqual.js'
import ComponentPosition from '#cwa/runtime/templates/components/core/ComponentPosition'
import ResourceLoader from '#cwa/runtime/templates/components/core/ResourceLoader'
import { CwaResourceTypes, getResourceTypeFromIri } from '#cwa/runtime/resources/resource-utils'
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

const methods = {
  async createComponentGroup () {
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
      allowedComponents: props.allowedComponents
    }
    if (locationProperty) {
      postData[locationProperty] = [props.location]
    }
    await $cwa.resourcesManager.createResource({
      endpoint: '/_/component_groups',
      data: postData
    })
  },
  async updateAllowedComponents () {
    if (_isEqual(props.allowedComponents, resource.value?.data?.allowedComponents)) {
      return
    }
    await $cwa.resourcesManager.updateResource({
      endpoint: resource.value.data['@id'],
      data: {
        allowedComponents: props.allowedComponents
      }
    })
  }
}

watch(() => [$cwa.resources.isLoading.value, $cwa.auth.signedIn.value, resource.value], async ([isLoading, signedIn, resource]) => {
  if (!isLoading && signedIn) {
    if (!resource) {
      await methods.createComponentGroup()
    } else if (resource.apiState.status === CwaResourceApiStatuses.SUCCESS) {
      await methods.updateAllowedComponents()
    }
  }
}, {
  immediate: true
})
</script>
