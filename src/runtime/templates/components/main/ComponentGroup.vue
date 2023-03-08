<template>
  <div>
    <div v-if="showLoader" class="component-group-placeholder cwa-p-3">
      <CwaUtilsSpinner :show="true" />
    </div>
    <template v-else>
      <pre>{{ resource.data }}</pre>
    </template>
  </div>
</template>

<script setup>
import { useNuxtApp } from '#app'
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { CwaResourceTypes } from '../../../resources/resource-utils'
import { CwaResourceApiStatuses } from '../../../storage/stores/resources/state'

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
  return componentGroups.find((resource) => {
    return resource.data?.reference === fullReference
  })
})

const showLoader = computed(() => {
  return resource.value?.apiState.status === CwaResourceApiStatuses.IN_PROGRESS
})

watch($cwa.resourcesManager.isLoading, (isLoading) => {
  if (!isLoading && !resource.value) {
    // todo: create component group
  }
}, {
  immediate: true
})
</script>
