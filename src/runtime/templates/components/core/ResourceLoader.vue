<template>
  <CwaUtilsAlertWarning v-if="!props.iri">
    <p>No IRI has been passed as a property to the `ResourceLoader` component</p>
  </CwaUtilsAlertWarning>
  <div v-else-if="isLoading">
    <CwaUtilsSpinner :show="true" />
  </div>
  <CwaUtilsAlertWarning v-else-if="!resolvedComponent">
    <p>The component `{{ uiComponent }}` cannot be found</p>
  </CwaUtilsAlertWarning>
  <component v-bind="$attrs" :is="resolvedComponent" v-else :iri="props.iri" />
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
  },
  componentPrefix: {
    type: String,
    required: false,
    default: ''
  },
  uiComponent: {
    type: [String, Object],
    required: false,
    default: undefined
  }
})

const resource = $cwa.resourcesManager.getResource(props.iri)

const isLoading = computed(() => {
  if (!resource.value) {
    return true
  }
  return resource.value?.apiState.status === CwaResourceApiStatuses.IN_PROGRESS
})

const uiComponent = computed(() => {
  if (!resource.value) {
    return
  }
  return props.componentPrefix + (resource.value.data.uiComponent || resource.value.data['@type'])
})

const resolvedComponent = computed(() => {
  if (props.uiComponent) {
    return props.uiComponent
  }

  if (!Object.keys(components).includes(uiComponent.value)) {
    return
  }
  // eslint-disable-next-line import/namespace
  return components[uiComponent.value]
})
</script>
