<template>
  <CwaUtilsAlertWarning v-if="!props.iri">
    <p>No IRI has been passed as a property to the `ResourceLoader` component</p>
  </CwaUtilsAlertWarning>
  <div v-else-if="isLoading">
    <CwaUtilsSpinner :show="true" />
  </div>
  <CwaUtilsAlertWarning v-else-if="(!resolvedComponent && !hasError) || (hasError && !hasSilentError)">
    <p v-if="!resource">
      Resource `{{ props.iri }}` has not been requested
    </p>
    <p v-else-if="!resource?.data">
      No data received for resource `{{ props.iri }}`
    </p>
    <p v-else>
      The component `{{ resourceUiComponent }}` for resource `{{ props.iri }}` cannot be resolved
    </p>
  </CwaUtilsAlertWarning>
  <component v-bind="$attrs" :is="resolvedComponent" v-else-if="!hasError" :iri="props.iri" />
</template>

<script setup>
import { computed, onMounted, watch, getCurrentInstance, ref, onBeforeMount } from 'vue'
import { CwaResourceApiStatuses } from '../../../storage/stores/resources/state'
import { iri, useCwa } from '#imports'

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

const resource = $cwa.resources.getResource(props.iri)

// Due to the nature of fetching down the tree of resources, a parent resource can know about a child IRI and place the resource loader immediately
// This can happen a split second before the API request is started. We do not want to assume that the child will begin to be fetched. The application is
// complicated so having a fallback with an error stating the resource was not fetched can be useful.
const resourceLoadBuffering = ref(!resource.value)
onBeforeMount(() => {
  if (resourceLoadBuffering.value) {
    setTimeout(() => {
      resourceLoadBuffering.value = false
    }, 20)
  }
})

const isLoading = computed(() => {
  if (resourceLoadBuffering.value) {
    return true
  }
  return !resource.value?.data && resource.value?.apiState.status === CwaResourceApiStatuses.IN_PROGRESS
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

const methods = {
  getFetchResourceDeps () {
    return [hasSilentError, resource]
  },
  async fetchResource ([hasSilentError, resource]) {
    if (resource.value?.apiState.ssr && !resource.value?.data && hasSilentError.value) {
      await $cwa.fetchResource({
        path: props.iri
      })
    }
  }
}

onMounted(() => {
  watch(methods.getFetchResourceDeps, methods.fetchResource, {
    immediate: true
  })
})

</script>
