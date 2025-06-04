import type { Ref } from 'vue'
import { computed, ref, watch } from 'vue'
import { type LocationQuery, useRoute } from 'vue-router'
import type { CwaResourceUtilsOps } from './cwa-resource'
import { useCwa, useCwaResource, useQueryBoundModel } from '#imports'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'

export const useCwaCollectionResource = (iri: Ref<string>, ops?: CwaResourceUtilsOps) => {
  const cwaResource = useCwaResource(iri, ops)
  const resource = cwaResource.getResource()

  const isLoadingCollection = ref(false)
  const fetchedCollectionItems = ref<CwaResource[]>()
  const loadCounter = ref(0)

  const $cwa = useCwa()
  const route = useRoute()
  // const { model: perPageModel } = useQueryBoundModel('perPage', { defaultValue: null, asNumber: true })
  const { model: pageModel } = useQueryBoundModel('page', { defaultValue: 1, asNumber: true })

  const collectionItems = computed<CwaResource[] | undefined>(() => {
    return fetchedCollectionItems.value || resource.value?.data?.collection?.['hydra:member']
  })

  const dataResourceIri = computed(() => {
    return resource.value?.data?.resourceIri
  })

  const totalPages = ref(1)

  function populateCollectionData(resource?: { collection?: { 'hydra:member': CwaResource[], 'hydra:view': { 'hydra:last': string } } } & CwaResource) {
    if (resource?.collection?.['hydra:member']) {
      fetchedCollectionItems.value = resource?.collection?.['hydra:member']
      const lastPagePath = resource?.collection?.['hydra:view']?.['hydra:last']
      if (!lastPagePath) {
        totalPages.value = 1
      }
      else {
        const urlParams = new URLSearchParams(lastPagePath.split('?')[1])
        const pageQueryParam = urlParams.get('page')
        totalPages.value = pageQueryParam ? (parseInt(pageQueryParam) || 1) : 1
      }
    }
  }

  async function reloadCollection() {
    if (!dataResourceIri.value) {
      return
    }
    const currentLoadCounter = ++loadCounter.value
    isLoadingCollection.value = true

    const { response } = $cwa.fetch({ path: iri.value })
    const { _data: resource } = await response

    if (currentLoadCounter === loadCounter.value) {
      populateCollectionData(resource)
      isLoadingCollection.value = false
    }
  }

  function goToNextPage() {
    if (pageModel.value >= totalPages.value) {
      return
    }
    changePage(pageModel.value + 1)
  }

  function goToPreviousPage() {
    if (!pageModel.value || pageModel.value <= 1) {
      return
    }
    changePage(pageModel.value - 1)
  }

  function changePage(newPageNumber: number) {
    pageModel.value = newPageNumber
  }

  // so components can be loaded in background still for the component manager to get metadata
  if (route) {
    watch(() => route.query, async (newQuery, oldQuery) => {
      const cleanPaginationFromQuery = (q: LocationQuery) => {
        const cleanQuery = { ...q }
        delete cleanQuery.perPage
        delete cleanQuery.page
        return cleanQuery
      }
      const cleanedOld = cleanPaginationFromQuery(oldQuery)
      const cleanedNew = cleanPaginationFromQuery(newQuery)
      if (JSON.stringify(cleanedOld) !== JSON.stringify(cleanedNew)) {
        pageModel.value = 1
      }

      if (JSON.stringify(oldQuery) === JSON.stringify(newQuery)) {
        return
      }
      await reloadCollection()
    })
  }

  populateCollectionData(resource.value?.data)

  watch(() => resource.value?.data, (newData) => {
    if (newData) {
      populateCollectionData(newData)
    }
  })

  return {
    ...cwaResource,
    resource,
    collectionItems,
    isLoadingCollection,
    pageModel,
    totalPages,
    goToNextPage,
    goToPreviousPage,
    changePage,
  }
}
