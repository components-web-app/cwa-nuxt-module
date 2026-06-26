import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { LocationQuery } from 'vue-router'
import type { CwaResource } from '#cwa/resources/resource-utils'
import { useCwaResourceRoute } from '#cwa/composables/useCwaResourceRoute'
import { useQueryBoundModel } from '#imports'
import type { CwaResourcePlugin } from './cwa-component'

export const withCollection = (): CwaResourcePlugin<{
  collectionItems: ReturnType<typeof computed<CwaResource[] | undefined>>
  isLoadingCollection: ReturnType<typeof ref<boolean>>
  pageModel: ReturnType<typeof ref<number>>
  totalPages: ReturnType<typeof ref<number>>
  goToNextPage: () => void
  goToPreviousPage: () => void
  changePage: (page: number) => void
  resolveResourceLink: ReturnType<typeof useCwaResourceRoute>['getResourceRoute']
}> => {
  return (ctx) => {
    const { iri, resource, $cwa } = ctx

    const isLoadingCollection = ref(false)
    const fetchedCollectionItems = ref<CwaResource[]>()
    const loadCounter = ref(0)

    const route = useRoute()
    const { model: pageModel } = useQueryBoundModel('page', { defaultValue: 1, asNumber: true })

    const collectionItems = computed<CwaResource[] | undefined>(() => {
      return fetchedCollectionItems.value || resource.value?.data?.collection?.['member']
    })

    const dataResourceIri = computed(() => {
      return resource.value?.data?.resourceIri
    })

    const totalPages = ref(1)

    function populateCollectionData(res?: { collection?: { member: CwaResource[], view: { last: string } } } & CwaResource) {
      if (res?.collection?.['member']) {
        fetchedCollectionItems.value = res.collection['member']
        const lastPagePath = res.collection['view']?.['last']
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
      const { _data: res } = await response

      if (currentLoadCounter === loadCounter.value) {
        populateCollectionData(res)
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
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
    }

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

    const { getResourceRoute } = useCwaResourceRoute()

    return {
      collectionItems,
      isLoadingCollection,
      pageModel,
      totalPages,
      goToNextPage,
      goToPreviousPage,
      changePage,
      resolveResourceLink: getResourceRoute,
    }
  }
}
