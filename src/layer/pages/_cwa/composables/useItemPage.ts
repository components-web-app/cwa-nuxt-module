import { computed, type ComputedRef, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'
import { useCwa } from '#cwa/runtime/composables/cwa'
import { ErrorType } from '#cwa/runtime/storage/stores/error/state'

type TempCwaResource = Omit<CwaResource, '@id'|'_metadata'>

type StartsWithHash = `#${string}`;

type UseItemOps = {
  createEndpoint: string
  emit: ((evt: 'close') => void) & ((evt: 'reload') => void),
  resourceType: string,
  defaultResource: Omit<TempCwaResource, '@type'>
  validate?: (data: any) => boolean|string
  endpoint?: string
  routeHashAfterAdd?: ComputedRef<StartsWithHash>
  iri?: string
}

export const useItemPage = ({ emit, resourceType, defaultResource, createEndpoint, validate, endpoint: userDefinedEndpoint, routeHashAfterAdd, iri }: UseItemOps) => {
  const $cwa = useCwa()
  const router = useRouter()
  const route = useRoute()
  const endpoint = userDefinedEndpoint || (Array.isArray(route.params.iri) ? route.params.iri[0] : route.params.iri)
  if (!endpoint) {
    throw new Error('No Endpoint Found For useItemPage composable')
  }

  const isLoading = ref(true)
  const isUpdating = ref(false)
  const localResourceData = ref<TempCwaResource|CwaResource>()

  const isAdding = computed(() => endpoint === 'add')
  const resource = computed(() => isAdding.value ? localResourceData.value : $cwa.resources.getResource(iri || endpoint).value?.data)

  function formatDate (dateStr:string) {
    return dayjs(dateStr).format('DD/MM/YY @ HH:mm UTCZ')
  }

  function loadResource () {
    if (isAdding.value) {
      localResourceData.value = {
        '@type': resourceType,
        ...defaultResource
      }
      return localResourceData.value
    }
    return $cwa.fetchResource({
      path: endpoint,
      iri
    })
  }

  async function deleteResource () {
    isUpdating.value = true
    await $cwa.resourcesManager.deleteResource({
      endpoint
    })
    emit('reload')
    emit('close')
    isUpdating.value = false
  }

  function saveTitle () {
    if (isAdding.value) {
      return
    }
    return saveResource()
  }

  async function saveResource (close = false) {
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
                property: 'plainPassword'
              }
            ]
          })
        }
        return
      }
    }
    const doRequest = async () => {
      const data = {
        ...localResourceData.value
      }
      if (isAdding.value) {
        const newResource = await $cwa.resourcesManager.createResource({
          endpoint: createEndpoint,
          data,
          source: 'admin-modal'
        })
        if (newResource) {
          emit('reload')
          if (close) {
            emit('close')
          } else {
            router.push({ name: route.name, params: { iri: newResource['@id'] }, query: route.query, hash: routeHashAfterAdd?.value })
          }
        }
        return
      }

      const updatedResource = await $cwa.resourcesManager.updateResource({
        endpoint,
        data
      })
      if (close && updatedResource) {
        emit('close')
      }
    }

    isUpdating.value = true
    await doRequest()
    isUpdating.value = false
  }

  watch(resource, (newResource) => {
    newResource && (localResourceData.value = newResource)
  })

  onMounted(async () => {
    await loadResource()
    if (!resource.value || resource.value['@type'] !== resourceType) {
      emit('close')
      return
    }
    localResourceData.value = { ...resource.value }
    isLoading.value = false
  })

  return {
    isLoading,
    isUpdating,
    resource,
    localResourceData,
    isAdding,
    formatDate,
    deleteResource,
    saveTitle,
    saveResource,
    loadResource
  }
}
