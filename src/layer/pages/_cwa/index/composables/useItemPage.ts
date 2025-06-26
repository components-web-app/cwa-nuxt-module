import { computed, type ComputedRef, isRef, onMounted, type Ref, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { useCwaResourceRoute } from '#cwa/runtime/composables/useCwaResourceRoute'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'
import { useCwa } from '#cwa/runtime/composables/cwa'
import { ErrorType } from '#cwa/runtime/storage/stores/error/state'
import type { ApiResourceEvent } from '#cwa/runtime/resources/resources-manager'

export type TempCwaResource = Omit<CwaResource, '@id' | '_metadata'>

type StartsWithHash = `#${string}`

type UseItemOps = {
  createEndpoint: string | Ref<string>
  emit: ((evt: 'close') => void) & ((evt: 'reload') => void)
  resourceType: string
  defaultResource: Omit<TempCwaResource, '@type'>
  validate?: (data: any) => boolean | string
  endpoint?: Ref<string | undefined>
  routeHashAfterAdd?: ComputedRef<StartsWithHash>
  iri?: Ref<string | undefined>
  excludeFields?: string[]
}

export const useItemPage = ({ emit, resourceType, defaultResource, createEndpoint, validate, endpoint: userDefinedEndpoint, routeHashAfterAdd, iri, excludeFields }: UseItemOps) => {
  const $cwa = useCwa()
  const router = useRouter()
  const route = useRoute()
  const endpoint = computed(() => userDefinedEndpoint?.value || (Array.isArray(route.params.iri) ? route.params.iri[0] : route.params.iri))
  if (!endpoint.value) {
    throw new Error('No Endpoint Found For useItemPage composable')
  }

  const isLoading = ref(true)
  const isUpdating = ref(false)
  const localResourceData = ref<TempCwaResource | CwaResource>()
  const resourceIri = computed(() => (iri?.value || endpoint.value))

  const isAdding = computed(() => endpoint.value === 'add')
  const apiState = computed(() => (isAdding.value ? undefined : $cwa.resources.getResource(resourceIri.value).value?.apiState))
  const resource = computed(() => isAdding.value ? localResourceData.value : $cwa.resources.getResource(resourceIri.value).value?.data)

  function formatDate(dateStr: string) {
    return dayjs(dateStr).format('DD/MM/YY @ HH:mm UTCZ')
  }

  async function loadResource() {
    if (isAdding.value) {
      localResourceData.value = {
        '@type': resourceType,
        ...defaultResource,
      }
      return localResourceData.value
    }
    const fetchProps = {
      path: endpoint.value,
      iri: iri?.value,
      shallowFetch: true,
    }
    const loadedResource = await $cwa.fetchResource(fetchProps)
    isLoading.value = false
    return loadedResource
  }

  async function deleteResource(refreshEndpoints?: string[] | undefined, requestCompleteFn?: ApiResourceEvent['requestCompleteFn']) {
    isUpdating.value = true
    await $cwa.resourcesManager.deleteResource({
      endpoint: iri?.value || endpoint.value,
      refreshEndpoints,
      requestCompleteFn,
      saveCompleteFn: () => {
        // if in cwa view
        emit('reload')
        emit('close')
      },
    })
    isUpdating.value = false
  }

  function saveTitle() {
    if (isAdding.value) {
      return
    }
    return saveResource()
  }

  async function saveResource(close = false) {
    if (!localResourceData.value) {
      return
    }
    if (validate) {
      const result = validate(localResourceData.value)
      if (result !== true) {
        if (result !== false) {
          $cwa.resourcesManager.addError({
            type: ErrorType.VALIDATION,
            timestamp: (new Date()).getTime(),
            statusCode: 0,
            detail: result,
            violations: [
              {
                message: result,
                property: 'plainPassword',
              },
            ],
          })
        }
        return
      }
    }
    const doRequest = async () => {
      const data: { [key: string]: any } = {
        ...localResourceData.value,
      }
      if (excludeFields) {
        for (const field of excludeFields) {
          data[field] && (delete data[field])
        }
      }
      if (isAdding.value) {
        const newResource = await $cwa.resourcesManager.createResource({
          endpoint: isRef(createEndpoint) ? createEndpoint.value : createEndpoint,
          data,
          source: 'admin-modal',
        })
        if (newResource) {
          emit('reload')
          if (close) {
            emit('close')
          }
          else {
            router.push({ name: route.name, params: { iri: newResource['@id'] }, query: route.query, hash: routeHashAfterAdd?.value })
          }
        }
        return newResource
      }

      const updatedResource = await $cwa.resourcesManager.updateResource({
        endpoint: iri?.value || endpoint.value,
        data,
      })
      if (close && updatedResource) {
        emit('close')
      }
      return updatedResource
    }

    isUpdating.value = true
    const resource = await doRequest()
    isUpdating.value = false
    return resource
  }

  function syncLocalResourceWithStore(newResource?: TempCwaResource | undefined) {
    const storeResource = newResource || resource.value
    if (!isAdding.value && storeResource) {
      localResourceData.value = { ...storeResource }
    }
  }

  watch(resource, syncLocalResourceWithStore)
  watch(endpoint, loadResource)

  onMounted(async () => {
    await loadResource()
    if (!resource.value || (resourceType !== undefined && resource.value['@type'] !== resourceType)) {
      emit('close')
      isLoading.value = false
      return
    }
    isLoading.value = false
  })

  const { getInternalResourceLink } = useCwaResourceRoute()

  return {
    isLoading,
    isUpdating,
    resource,
    localResourceData,
    isAdding,
    apiState,
    formatDate,
    deleteResource,
    saveTitle,
    saveResource,
    loadResource,
    resetResource: syncLocalResourceWithStore,
    getInternalResourceLink,
  }
}
