import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import dayjs from 'dayjs'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'
import { useCwa } from '#cwa/runtime/composables/cwa'

type LimitedCwaResource = Omit<CwaResource, '@id'|'_metadata'>

type UseItemOps = {
  createEndpoint: string
  emit: ((evt: 'close') => void) & ((evt: 'reload') => void),
  resourceType: string,
  defaultResource: Omit<LimitedCwaResource, '@type'>
}

export const useItemPage = ({ emit, resourceType, defaultResource, createEndpoint }: UseItemOps) => {
  const $cwa = useCwa()
  const route = useRoute()
  const endpoint = Array.isArray(route.params.iri) ? route.params.iri[0] : route.params.iri

  const isLoading = ref(true)
  const isUpdating = ref(false)
  const localResourceData = ref<LimitedCwaResource>()

  const isAdding = computed(() => endpoint === 'add')
  const resource = computed(() => isAdding.value ? localResourceData.value : $cwa.resources.getResource(endpoint).value?.data)

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
      path: endpoint
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

  function saveReference () {
    if (isAdding.value) {
      return
    }
    return saveResource()
  }

  async function saveResource (close = false) {
    isUpdating.value = true
    const data = {
      reference: localResourceData.value?.reference,
      uiComponent: localResourceData.value?.uiComponent,
      uiClassNames: localResourceData.value?.uiClassNames
    }
    if (isAdding.value) {
      await $cwa.resourcesManager.createResource({
        endpoint: createEndpoint,
        data,
        source: 'admin-modal'
      })
      emit('reload')
      emit('close')
    } else {
      await $cwa.resourcesManager.updateResource({
        endpoint,
        data
      })
      if (close) {
        emit('close')
      }
    }
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
    localResourceData,
    isAdding,
    formatDate,
    deleteResource,
    saveReference,
    saveResource
  }
}
