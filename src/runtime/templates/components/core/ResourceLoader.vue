<template>
  <div v-if="!props.iri">
    No IRI has been passed as a property to the ResourceLoader
  </div>
  <CwaUtilsSpinner v-else-if="isLoading" />
  <component :is="resolvedComponent" v-else-if="resolvedComponent" :iri="props.iri" />
  <div v-else>
    The component {{ uiComponent }} does not exist
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useNuxtApp } from '#app'
import { CwaResourceApiStatuses } from '../../../storage/stores/resources/state'
import * as components from '#components'

const { $cwa } = useNuxtApp()

const props = defineProps({
  iri: {
    type: String,
    required: true
  }
})

const resource = $cwa.resourcesManager.getResource(props.iri)

const isLoading = computed(() => {
  if (!resource.value) {
    return false
  }
  return resource.value?.apiState.status === CwaResourceApiStatuses.IN_PROGRESS
})

const uiComponent = computed(() => {
  if (!resource.value) {
    return
  }
  return 'CwaPage' + (resource.value.data.uiComponent || resource.value.data['@type'])
})

const resolvedComponent = computed(() => {
  if (!Object.keys(components).includes(uiComponent.value)) {
    return
  }
  // eslint-disable-next-line import/namespace
  return components[uiComponent.value]
})
</script>
