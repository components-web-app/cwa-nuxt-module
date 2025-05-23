<template>
  <div v-if="isLoading">
    <Spinner :show="true" />
  </div>
  <CwaUiAlertWarning v-else-if="warningPlaceholder">
    <p>{{ warningPlaceholder }}</p>
  </CwaUiAlertWarning>
  <component
    v-bind="$attrs"
    :is="resolvedComponent"
    v-else-if="!!resource?.data && iri"
    ref="resourceComponent"
    :iri="iri"
    :class="resourceClassNames"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, watch, getCurrentInstance, ref, onBeforeMount, useTemplateRef } from 'vue'
import { CwaResourceApiStatuses } from '../../../storage/stores/resources/state'
import type { CwaResourceApiStateError } from '../../../storage/stores/resources/state'
import { type CwaResourceMeta, useCwa } from '#imports'
import type { IriProp } from '#cwa/runtime/composables/cwa-resource.js'
import {
  CwaResourceTypes,
  getPublishedResourceState,
  getResourceTypeFromIri,
} from '#cwa/runtime/resources/resource-utils'
import Spinner from '#cwa/runtime/templates/components/utils/Spinner.vue'

const $cwa = useCwa()
const instance = getCurrentInstance()

const props = withDefaults(
  defineProps<IriProp & { componentPrefix?: string, uiComponent?: any }>(),
  {
    componentPrefix: '',
    uiComponent: undefined,
  },
)

const resource = computed(() => $cwa.resources.getResource(props.iri).value)
const resourceComponent = useTemplateRef<CwaResourceMeta>('resourceComponent')

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
  if (!props.iri) {
    return false
  }
  const isLoading = !!resource.value && !resource.value?.data && resource.value?.apiState.status === CwaResourceApiStatuses.IN_PROGRESS
  return isLoading || (resource.value === undefined && resourceLoadBuffering.value)
})

const warningPlaceholder = computed((): string | undefined => {
  if (!props.iri) {
    return 'No IRI has been passed as a property to the `ResourceLoader` component'
  }
  if (!resource.value) {
    return `Resource '${props.iri}' has not been requested`
  }
  if (resourceUiComponent.value && !resolvedComponent.value) {
    return `The component '${resourceUiComponent.value}' for resource '${props.iri}' cannot be resolved`
  }
  return undefined
})

const resourceUiComponent = computed(() => {
  const data = resource.value?.data
  if (!data) {
    return
  }
  const rawName = (data.uiComponent || data['@type'])
  if (!rawName) {
    return
  }
  if (!props.componentPrefix) {
    return rawName
  }
  const regExp = new RegExp(`^${props.componentPrefix}`)
  return props.componentPrefix + rawName.replace(regExp, '')
})

const resourceClassNames = computed(() => {
  return resource.value?.data?.uiClassNames
})

const hasError = computed(() => {
  return resource.value?.apiState.status === CwaResourceApiStatuses.ERROR
})

const hasSilentError = computed<boolean>(() => {
  if (!hasError.value) {
    return false
  }
  const state = resource.value?.apiState as CwaResourceApiStateError
  const statusCode = state.error?.statusCode
  return !!(statusCode && statusCode >= 400 && statusCode < 500)
})

// todo: adjust to not be global https://github.com/nuxt/nuxt/issues/14036#issuecomment-2110180751
const resolvedComponent = computed(() => {
  if (props.uiComponent) {
    return props.uiComponent
  }
  if (
    typeof instance?.appContext.components !== 'object'
    || !resourceUiComponent.value
    || !(resourceUiComponent.value in instance.appContext.components)
  ) {
    return
  }

  return resourceUiComponent.value
})

const ssrNoDataWithSilentError = computed(() => {
  return resource.value?.apiState.ssr && resource.value?.data === undefined && hasSilentError
})

const ssrPositionHasPartialData = computed(() => {
  // error caused by position and component both re-fetching at the same time. We get a scheduler flush issue - 'Cannot read properties of null (reading 'parentNode')'
  // occurs if the component only has a draft version and on server load, then client-side tries to refresh the component and the position at the same time
  return resource.value?.apiState.ssr
    && !!$cwa.auth.user
    && getResourceTypeFromIri(props.iri) === CwaResourceTypes.COMPONENT_POSITION
    && $cwa.resources.usesPageTemplate.value
})

const refetchPublishedSsrResourceToResolveDraft = computed(() => {
  if (getResourceTypeFromIri(props.iri) !== CwaResourceTypes.COMPONENT) {
    return false
  }
  if (!resource.value) {
    return
  }
  // will always have metadata even if not auth saying whether it's published or not
  const publishableState = getPublishedResourceState(resource.value)

  // if we already fetched a draft then we had permissions, if it was from server, and fetched published, we should re-fetch to check for draft version
  // the next fetch would simply fetch the draft if it's available as the default response from the API
  return publishableState === true
    && resource.value?.apiState.ssr
    && $cwa.auth.user
})

// With ISR when the page is loaded it could be cached, this should trigger on front-end still and can send a request to update/check the component from the API again
const isOutdated = computed(() => {
  const apiState = resource.value?.apiState
  // if we have fetched successfully already and have a timestamp for when that was, or it was loaded client-side already
  if (!apiState || apiState.status !== CwaResourceApiStatuses.SUCCESS || !apiState.fetchedAt || !apiState.ssr) {
    return
  }
  const nowTime = (new Date()).getTime()
  const timeDifference = nowTime - apiState.fetchedAt
  return timeDifference > 5000
})

async function clientFetchResource() {
  await $cwa.fetchResource({
    path: props.iri,
  })
}

const methods = {
  async fetchResource() {
    if (isLoading.value) {
      return
    }
    if (
      ssrNoDataWithSilentError.value
      || ssrPositionHasPartialData.value
      || refetchPublishedSsrResourceToResolveDraft.value
    ) {
      await clientFetchResource()
    }

    // once we have a resource we need to make sure we have loaded the published as well if it is a draft, and the draft
    // if it is published. Just in case the server was also authenticated to load the draft - so we cannot guarantee that
    // a draft being loaded will also have the published
  },
}

onMounted(() => {
  isOutdated.value && clientFetchResource()

  // if has a silent error, we are client-side and last attempt was not while logged in
  // todo: NOT SURE IF NEEDS DOING STILL... FIND THE BUG REPRODUCTION BEFORE IMPLEMENTING if resource is publishable, published and request was a server-side request, refresh with a client-side request
  watch([hasSilentError, resource], methods.fetchResource, {
    immediate: true,
  })
})

defineExpose({
  resourceComponent,
})

// TODO - NOT SURE IF NEEDS DOING STILL... FIND THE BUG REPRODUCTION BEFORE IMPLEMENTING - server-side no auth will load published and no publishable meta link to draft, client-side auth will load draft if available with published meta link, or published with no draft
</script>
