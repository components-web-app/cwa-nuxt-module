<template>
  <div>
    <CwaUtilsSpinner v-if="isLoading" />
    <component :is="resolvedComponent" v-else-if="resolvedComponent" :iri="props.iri" />
    <div v-else>
      The component {{ uiComponent }} does not exist
    </div>
  </div>
</template>

<script setup>
import { computed, defineProps } from 'vue'
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
  return resource.value?.apiState.status === CwaResourceApiStatuses.IN_PROGRESS
})

const uiComponent = computed(() => {
  return 'CwaPage' + (resource.value.data.uiComponent || resource.value.data['@type'])
})

const resolvedComponent = computed(() => {
  if (!Object.keys(components).includes(uiComponent.value)) {
    return
  }
  return components[uiComponent.value]
})
</script>
