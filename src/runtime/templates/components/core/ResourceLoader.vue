<template>
  <CwaUiAlertWarning v-if="!props.iri">
    <p>No IRI has been passed as a property to the `ResourceLoader` component</p>
  </CwaUiAlertWarning>
  <div v-else-if="isLoading">
    <CwaUiSpinner :show="true" />
  </div>
  <CwaUiAlertWarning v-else-if="(!resolvedComponent && !hasError) || (hasError && !hasSilentError)">
    <p v-if="!resource">
      Resource `{{ props.iri }}` has not been requested
    </p>
    <p v-else-if="!resource?.data">
      No data received for resource `{{ props.iri }}`
    </p>
    <p v-else>
      The component `{{ resourceUiComponent }}` for resource `{{ props.iri }}` cannot be resolved
    </p>
  </CwaUiAlertWarning>
  <template v-else-if="!hasError">
    <component v-bind="$attrs" :is="resolvedComponent" :iri="props.iri" />
  </template>
</template>

<script setup lang="ts">
import { computed, onMounted, watch, getCurrentInstance, ref, onBeforeMount } from 'vue'
import { CwaCurrentResourceInterface, CwaResourceApiStatuses } from '../../../storage/stores/resources/state'
import { useCwa } from '#imports'
import { IriProp } from '#cwa/runtime/composables/cwa-resource.js'

const $cwa = useCwa()

const props = withDefaults(
  defineProps<IriProp & { componentPrefix?: string, uiComponent?: any }>(),
  {
    componentPrefix: '',
    uiComponent: undefined
  }
)

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
  return !!resource.value && !resource.value?.data && resource.value?.apiState.status === CwaResourceApiStatuses.IN_PROGRESS
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

const hasSilentError = computed<boolean>(() => {
  if (!resource.value || resource.value.apiState.status !== CwaResourceApiStatuses.ERROR) {
    return false
  }
  const statusCode = resource.value?.apiState?.error?.statusCode
  return !!(statusCode && statusCode >= 400 && statusCode < 500)
})

const resolvedComponent = computed(() => {
  if (props.uiComponent) {
    return props.uiComponent
  }

  const instance = getCurrentInstance()
  if (
    typeof instance?.appContext.components !== 'object' ||
    !resourceUiComponent.value ||
    !(resourceUiComponent.value in instance.appContext.components)
  ) {
    return
  }

  return resourceUiComponent.value
})

const methods = {
  async fetchResource ([hasSilentError, resource]: [boolean, CwaCurrentResourceInterface]) {
    const ssrNoDataWithSilentError = resource?.apiState.ssr && !resource?.data && hasSilentError
    if (ssrNoDataWithSilentError) {
      await $cwa.fetchResource({
        path: props.iri
      })
    }
  }
}

onMounted(() => {
  // if has a silent error, we are client-side and last attempt was not while logged in
  watch([hasSilentError, resource], methods.fetchResource, {
    immediate: true
  })
})

</script>
