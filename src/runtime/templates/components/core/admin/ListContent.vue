<template>
  <div
    class="cwa:mx-auto cwa:w-full cwa:max-w-6xl cwa:px-4 cwa:pb-12 cwa:sm:px-8"
    data-testid="list-content"
  >
    <slot name="notice" />
    <CwaUiAlert
      v-if="loadError"
      tone="danger"
      :title="`${capitalise(noun)} couldn't be loaded.`"
      class="cwa:mb-4"
      data-testid="list-error"
    >
      <p class="cwa:m-0">
        {{ loadError }}<template v-if="items.length">
          {{ ageText }}
        </template>
      </p>
      <template #actions>
        <CwaUiButton
          label="Retry"
          data-testid="list-retry"
          :loading="loading"
          @click="reloadItems"
        />
      </template>
    </CwaUiAlert>
    <div
      role="table"
      :aria-label="capitalise(noun)"
      :aria-busy="loading ? 'true' : undefined"
      :style="{ '--cwa-list-columns': columnTemplate }"
      data-testid="list-table"
    >
      <div
        role="rowgroup"
        class="cwa:max-md:hidden"
      >
        <div
          role="row"
          class="cwa:grid cwa:h-10 cwa:grid-cols-(--cwa-list-columns) cwa:items-center cwa:gap-x-4 cwa:border-b cwa:border-line cwa:px-4"
        >
          <span
            v-for="column in columns"
            :key="column.label"
            role="columnheader"
            class="cwa:truncate cwa:text-helper cwa:text-fg-muted"
            :class="{ 'cwa:text-end': column.align === 'end' }"
          ><span :class="{ 'cwa:sr-only': column.labelHidden }">{{ column.label }}</span></span>
        </div>
      </div>
      <div
        role="rowgroup"
        :class="{ 'cwa:opacity-60 cwa:transition-opacity': (loading || loadError) && items.length }"
      >
        <template v-if="items.length">
          <template
            v-for="item in items"
            :key="item['@id']"
          >
            <slot
              name="item"
              v-bind="{ data: getItemFromStore(item), rawData: item }"
            />
          </template>
        </template>
      </div>
    </div>
    <ListState
      v-if="loading && !items.length"
      state="loading"
      :noun="noun"
    />
    <ListState
      v-else-if="!loading && !items.length && !loadError"
      state="empty"
      :noun="noun"
      :title="emptyTitle"
    >
      <CwaUiButton
        v-if="filterKeys.length"
        :label="filtered ? 'Clear filters' : 'Clear search'"
        data-testid="list-clear-filters"
        @click="clearFilters"
      />
      <slot
        v-else
        name="empty"
      />
    </ListState>
    <Pagination
      v-if="items.length"
      v-model:page="pageModel"
      :total="hydraData?.totalItems || 0"
      :per-page="perPageModel || PER_PAGE"
      :label="`${capitalise(noun)} pages`"
      class="cwa:mt-6"
    />
    <span
      role="status"
      class="cwa:sr-only"
      data-testid="list-announcer"
    >{{ announcement }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { consola as logger } from 'consola'
import { useRoute, useRouter } from 'vue-router'
import type { LocationQuery } from 'vue-router'
import CwaUiAlert from '#cwa/templates/components/ui/Alert.vue'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import ListState from '#cwa/templates/components/core/ui/ListState.vue'
import Pagination from '#cwa/templates/components/core/ui/Pagination.vue'
import { useCwa } from '#cwa/composables/cwa'
import { useQueryBoundModel } from '#cwa/composables/cwa-query-bound-model'
import { mergeQueryIntoPath } from '#cwa/api/fetcher/query-utils'
import type { CwaResource } from '#cwa/resources/resource-utils'

export interface ListColumn {
  label: string
  width?: string
  align?: 'end'
  labelHidden?: boolean
}

const PER_PAGE = 20
const NOT_A_FILTER = /^(?:page|perPage|order(?:\[.*\])?|cwa_force)$/

const $cwa = useCwa()
const route = useRoute()
const router = useRouter()
const { model: perPageModel } = useQueryBoundModel('perPage', { defaultValue: null, asNumber: true })
const { model: pageModel } = useQueryBoundModel('page', { defaultValue: 1, asNumber: true })

watch(pageModel, () => {
  window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
})

watch(perPageModel, (newValue) => {
  if (!newValue) {
    perPageModel.value = PER_PAGE
  }
}, {
  immediate: true,
})

const props = withDefaults(defineProps<{
  fetchUrl: string
  searchFields?: string[]
  noun?: string
  columns?: ListColumn[]
}>(), {
  searchFields: undefined,
  noun: 'items',
  columns: () => [{ label: 'Name' }],
})

const emit = defineEmits<{
  loaded: [items: CwaResource[]]
}>()

const loading = ref(true)
const items = ref<any[]>([])
const hydraData = ref<{ totalItems: number, view?: unknown }>()
const currentRequestId = ref<number>(0)
const loadError = ref<string>()
const loadedAt = ref<number>()
const ageText = ref('')
const announcement = ref('')

const columnTemplate = computed(() => props.columns.map((column, index) => index === 0 ? 'minmax(0,1fr)' : (column.width ?? 'auto')).join(' '))

const searchText = computed(() => {
  const search = route.query.search
  return typeof search === 'string' ? search.trim() : ''
})

const filterKeys = computed(() => Object.keys(route.query).filter((key) => {
  const value = route.query[key]
  return !NOT_A_FILTER.test(key) && (Array.isArray(value) ? value.some(entry => !!entry?.trim()) : !!value?.trim())
}))

const filtered = computed(() => filterKeys.value.some(key => key !== 'search'))

const emptyTitle = computed(() => {
  if (filtered.value) {
    return `No ${props.noun} match these filters.`
  }
  return searchText.value ? `No ${props.noun} match “${searchText.value}”.` : undefined
})

function clearFilters() {
  router.replace({ query: Object.fromEntries(Object.entries(route.query).filter(([key]) => key !== 'page' && NOT_A_FILTER.test(key))) })
}

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function loadFailureMessage(error: unknown) {
  const statusCode = (error as { statusCode?: number } | undefined)?.statusCode
  return statusCode ? `The server answered ${statusCode}.` : 'The server couldn\'t be reached.'
}

function describeAge() {
  if (!loadedAt.value) {
    return ''
  }
  const minutes = Math.round((Date.now() - loadedAt.value) / 60000)
  if (minutes < 1) {
    return 'The list below is from less than a minute ago.'
  }
  return `The list below is from ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago.`
}

function buildRequestQuery(): LocationQuery {
  const query: LocationQuery = { ...route.query }
  const search = query.search
  if (!search || !props.searchFields) {
    return query
  }
  for (const field of props.searchFields) {
    if (query[field] === undefined) {
      query[field] = search
    }
  }
  return query
}

async function reloadItems() {
  const thisRequestId = currentRequestId.value + 1
  currentRequestId.value = thisRequestId
  loading.value = true
  items.value.length || (announcement.value = `Loading ${props.noun}`)

  try {
    const { response } = $cwa.fetch({ path: mergeQueryIntoPath(props.fetchUrl, buildRequestQuery()), noQuery: true })
    const { _data: data } = await response
    if (thisRequestId !== currentRequestId.value) {
      return
    }
    const lastPage = Math.ceil((data?.['totalItems'] || 0) / (perPageModel.value || PER_PAGE))
    if (!data?.['member']?.length && lastPage > 0 && lastPage < (pageModel.value ?? 1)) {
      pageModel.value = lastPage
      return
    }
    hydraData.value = {
      totalItems: data?.['totalItems'] || 0,
      view: data?.['view'],
    }
    items.value = data?.['member'] ?? []
    loadError.value = undefined
    loadedAt.value = Date.now()
    loading.value = false
    announcement.value = `${hydraData.value.totalItems} ${props.noun}`
    emit('loaded', items.value)
  }
  catch (error) {
    if (thisRequestId !== currentRequestId.value) {
      return
    }
    loadError.value = loadFailureMessage(error)
    ageText.value = describeAge()
    loading.value = false
    logger.error('[CWA] Could not load the list', error)
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

const total = computed(() => hydraData.value?.totalItems)

defineExpose({
  reloadItems,
  total,
})

defineSlots<{
  item(
    props: {
      data: ReturnType<typeof getItemFromStore>
      rawData: typeof items.value[0]
    }
  ): any
  empty(): any
  notice(): any
}>()
</script>
