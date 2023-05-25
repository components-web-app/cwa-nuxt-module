<template>
  <CwaUtilsAlertWarning v-if="!props.iri">
    <p>No IRI has been passed as a property to the `ResourceLoader` component</p>
  </CwaUtilsAlertWarning>
  <div v-else-if="isLoading">
    <CwaUtilsSpinner :show="true" />
  </div>
  <CwaUtilsAlertWarning v-else-if="(!resolvedComponent && !hasError) || (hasError && !hasSilentError)">
    <p v-if="!resource">
      Resource not found with iri `{{ props.iri }}`
    </p>
    <p v-else-if="!resource?.data">
      Resource not found with iri `{{ props.iri }}` data
    </p>
    <p v-else>
      The component `{{ resourceUiComponent }}` cannot be found
    </p>
  </CwaUtilsAlertWarning>
  <component v-bind="$attrs" :is="resolvedComponent" v-else-if="!hasError" :iri="props.iri" />
</template>

<script setup>
import { computed, onMounted, watch, getCurrentInstance, ref } from 'vue'
import { CwaResourceApiStatuses } from '../../../storage/stores/resources/state'
import { CwaAuthStatus } from '../../../api/auth'
import { useCwaResource, iri, useCwa } from '#imports'

const $cwa = useCwa()

const props = defineProps({
  ...iri,
  componentPrefix: {
    type: String,
    required: false,
    default: ''
  },
  uiComponent: {
    type: Object,
    required: false,
    default: undefined
  }
})

const resource = useCwaResource(props.iri)

const resourceLoadPendingStart = ref<Boolean>(!resource.value)
setTimeout(() => {
  if (resourceLoadPendingStart.value && resource.value) {
    resourceLoadPendingStart.value = false
  }
}, 20)

const isLoading = computed(() => {
  if (resourceLoadPendingStart.value) {
    return true
  }
  return !resource.value.data && resource.value.apiState.status === CwaResourceApiStatuses.IN_PROGRESS
})

const resourceUiComponent = computed(() => {
  if (!resource.value || !resource.value?.data) {
    return
  }
  return props.componentPrefix + (resource.value.data.uiComponent || resource.value.data['@type'])
})

const hasError = computed(() => {
  return resource.value?.apiState.status === CwaResourceApiStatuses.ERROR
})

const hasSilentError = computed(() => {
  return hasError.value && resource.value?.apiState.error.statusCode >= 400 && resource.value?.apiState.error.statusCode < 500
})

const resolvedComponent = computed(() => {
  if (props.uiComponent) {
    return props.uiComponent
  }

  const instance = getCurrentInstance()

  if (typeof instance?.appContext.components !== 'object' || !(resourceUiComponent.value in instance.appContext.components)) {
    return
  }

  return resourceUiComponent.value
})

onMounted(() => {
  watch(() => [$cwa.auth.status, hasSilentError, resource], async ([authStatus, hasSilentError, resource]) => {
    if (!resource.value?.data && hasSilentError.value && authStatus.value === CwaAuthStatus.SIGNED_IN) {
      await $cwa.fetchResource({
        path: props.iri
      })
    }
  }, {
    immediate: true
  })
})

</script>
