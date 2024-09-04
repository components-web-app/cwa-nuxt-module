<template>
  <div class="pb-5 flex flex-col space-y-2">
    <CollectionSearch />
    <div v-if="collectionItems" class="relative flex flex-wrap -mx-4 min-h-96">
      <article v-for="post of collectionItems" :key="post['@id']" class="mx-4 my-4 w-[calc(25%-2rem)] relative z-0 isolate flex flex-col justify-end overflow-hidden rounded-2xl bg-gray-900 px-8 pb-8 pt-80 sm:pt-48 lg:pt-60">
        <img v-if="post.image" :src="post.image" alt="" class="absolute inset-0 -z-10 h-full w-full object-cover">
        <div v-else class="absolute inset-0 -z-10 h-full w-full text-white flex justify-center items-center font-bold">
          No Image
        </div>
        <div class="absolute inset-0 -z-10 bg-gradient-to-t from-gray-900 via-gray-900/40" />
        <div class="absolute inset-0 -z-10 rounded-2xl ring-1 ring-inset ring-gray-900/10" />
        <div class="flex flex-wrap items-center gap-y-1 overflow-hidden text-sm leading-3 text-gray-300">
          <time :datetime="post.createdAt" class="mr-8">{{ formatDate(post.createdAt) }}</time>
        </div>
        <h3 class="mt-3 text-lg font-semibold leading-6 text-white">
          <NuxtLink :to="post.routePath">
            <span class="absolute inset-0" />
            {{ post.title }}
          </NuxtLink>
        </h3>
      </article>
      <div v-if="!collectionItems.length" class="absolute top-0 left-0 right-0 bottom-0 bg-white/50 flex justify-center items-center font-bold text-2xl text-gray-700">
        No Results
      </div>
      <Transition
        enter-from-class="transform opacity-0"
        enter-active-class="duration-300 ease-out"
        enter-to-class="opacity-100"
        leave-from-class="opacity-100"
        leave-active-class="duration-300 ease-in"
        leave-to-class="transform opacity-0"
      >
        <div v-if="isLoadingCollection" class="absolute z-10 top-0 left-0 right-0 bottom-0 bg-white/50 flex justify-center items-center">
          <Spinner :show="true" />
        </div>
      </Transition>
    </div>
    <CollectionPagination
      class="w-full"
      :current-page="pageModel || 1"
      :total-pages="totalPages"
      :max-pages-to-display="7"
      @next="goToNextPage"
      @previous="goToPreviousPage"
      @change="changePage"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue'
import dayjs from 'dayjs'
import { type LocationQuery, useRoute } from 'vue-router'
import Spinner from '#cwa/runtime/templates/components/utils/Spinner.vue'
import type { IriProp } from '#cwa/runtime/composables/cwa-resource'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'
import { useCwa, useCwaResource, useQueryBoundModel } from '#imports'

const props = defineProps<IriProp>()

const { getResource, exposeMeta } = useCwaResource(toRef(props, 'iri'))
const resource = getResource()

function formatDate (dateStr:string) {
  return dayjs(dateStr).format('DD/MM/YY')
}

// parts which could be from a CWA module composable
const isLoadingCollection = ref(false)
const fetchedCollectionItems = ref<CwaResource[]>()
const loadCounter = ref(0)

const $cwa = useCwa()
const route = useRoute()
// const { model: perPageModel } = useQueryBoundModel('perPage', { defaultValue: null, asNumber: true })
const { model: pageModel } = useQueryBoundModel('page', { defaultValue: 1, asNumber: true })

const collectionItems = computed<CwaResource[]|undefined>(() => {
  return fetchedCollectionItems.value || resource.value?.data?.collection?.['hydra:member']
})

const dataResourceIri = computed(() => {
  return resource.value?.data?.resourceIri
})

const totalPages = ref(1)

function populateCollectionData (resource?: { collection?: { 'hydra:member': CwaResource[], 'hydra:view': { 'hydra:last': string } } } & CwaResource) {
  if (resource?.collection?.['hydra:member']) {
    fetchedCollectionItems.value = resource?.collection?.['hydra:member']
    const lastPagePath = resource?.collection?.['hydra:view']?.['hydra:last']
    if (!lastPagePath) {
      totalPages.value = 1
    } else {
      const urlParams = new URLSearchParams(lastPagePath.split('?')[1])
      const pageQueryParam = urlParams.get('page')
      totalPages.value = pageQueryParam ? (parseInt(pageQueryParam) || 1) : 1
    }
  }
}

async function reloadCollection () {
  if (!dataResourceIri.value) {
    return
  }
  const currentLoadCounter = ++loadCounter.value
  isLoadingCollection.value = true

  const { response } = $cwa.fetch({ path: props.iri })
  const { _data: resource } = await response

  if (currentLoadCounter === loadCounter.value) {
    populateCollectionData(resource)
    isLoadingCollection.value = false
  }
}

function goToNextPage () {
  if (pageModel.value >= totalPages.value) {
    return
  }
  changePage(pageModel.value + 1)
}

function goToPreviousPage () {
  if (!pageModel.value || pageModel.value <= 1) {
    return
  }
  changePage(pageModel.value - 1)
}

function changePage (newPageNumber: number) {
  pageModel.value = newPageNumber
}

watch(() => route.query, (newQuery, oldQuery) => {
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
  reloadCollection()
})

populateCollectionData(resource.value?.data)
// end composable

defineExpose(exposeMeta)
</script>
