<template>
  <ListContainer class="cwa:py-4">
    <div class="cwa:relative">
      <Transition
        appear
        mode="out-in"
        enter-from-class="cwa:transform cwa:opacity-0"
        enter-active-class="cwa:duration-200 cwa:ease-out"
        enter-to-class="cwa:opacity-100"
        leave-from-class="cwa:opacity-100"
        leave-active-class="cwa:duration-200 cwa:ease-in"
        leave-to-class="cwa:transform cwa:opacity-0"
      >
        <Spinner
          v-if="loading"
          class="cwa:absolute"
          :show="true"
        />
        <div
          v-else-if="!items.length"
          class="cwa:flex cwa:justify-center"
        >
          <div class="cwa:w-full cwa:max-w-xl cwa:text-center cwa:flex cwa:flex-col cwa:gap-y-2 cwa:text-stone-400">
            <div class="cwa:flex cwa:justify-center">
              <CwaUiIconWarningIcon class="cwa:w-20" />
            </div>
            <h2 class="cwa:font-bold">
              Sorry, no items found
            </h2>
          </div>
        </div>
        <div v-else>
          <ListPagination
            v-model:page.number="pageModel"
            v-model:per-page.number="perPageModel"
            :total-items="hydraData.totalItems || 0"
          />
          <ul class="cwa:flex cwa:flex-col cwa:mb-8">
            <li
              v-for="(item, index) in items"
              :key="`list-item-${index}`"
            >
              <slot
                name="item"
                v-bind="{ data: getItemFromStore(item), rawData: item }"
              >
                <div class="cwa:dark-blur cwa:p-2 cwa:border cwa:border-light/20">
                  <span class="cwa:font-bold">No list item template UI provided</span>
                  <pre class="cwa:text-xs cwa:p-2 cwa:max-h-40 cwa:overflow-auto">{{ item }}</pre>
                </div>
              </slot>
            </li>
          </ul>
          <ListPagination
            v-model:page.number="pageModel"
            v-model:per-page.number="perPageModel"
            :total-items="hydraData.totalItems || 0"
          />
        </div>
      </Transition>
    </div>
  </ListContainer>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { type LocationQuery, useRoute } from 'vue-router'
import ListContainer from './ListContainer.vue'
import ListPagination from './ListPagination.vue'
import Spinner from '#cwa/runtime/templates/components/utils/Spinner.vue'
import { useCwa, useQueryBoundModel } from '#imports'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'

const $cwa = useCwa()
const route = useRoute()
const { model: perPageModel } = useQueryBoundModel('perPage', { defaultValue: null, asNumber: true })
const { model: pageModel } = useQueryBoundModel('page', { defaultValue: 1, asNumber: true })

watch(perPageModel, (newValue) => {
  if (!newValue) {
    perPageModel.value = 5
  }
}, {
  immediate: true,
})

const props = defineProps<{
  fetchUrl: string
}>()

const loading = ref(true)
const items = ref<any[]>([])
const hydraData = ref()
const currentRequestId = ref<number>(0)

async function reloadItems() {
  const thisRequestId = currentRequestId.value + 1
  currentRequestId.value = thisRequestId
  loading.value = true

  const { response } = $cwa.fetch({ path: props.fetchUrl })
  const { _data: data } = await response
  /*
  hydra:totalItems: 123
  hydra:view:
    @id: "/_/routes?perPage=5&page=1"
    @type: "hydra:PartialCollectionView"
    hydra:first: "/_/routes?perPage=5&page=1"
    hydra:last: "/_/routes?perPage=5&page=5"
    hydra:next: "/_/routes?perPage=5&page=2"
   */
  hydraData.value = {
    totalItems: data?.['hydra:totalItems'] || 0,
    view: data?.['hydra:view'],
  }
  if (thisRequestId === currentRequestId.value) {
    data && (items.value = data['hydra:member'])
    loading.value = false
  }
}

function getItemFromStore(item: CwaResource) {
  const storeItemData = $cwa.resources.getResource(item['@id']).value?.data
  return storeItemData || item
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
}, {
  deep: true,
})

watch(() => route.query, (oldQuery, newQuery) => {
  if (JSON.stringify(oldQuery) === JSON.stringify(newQuery)) {
    return
  }
  reloadItems()
})

onMounted(() => {
  reloadItems()
})

defineExpose({
  reloadItems,
})
</script>
