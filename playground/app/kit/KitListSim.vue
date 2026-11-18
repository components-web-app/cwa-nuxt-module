<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CwaUiAlert, CwaUiButton, CwaUiSegmented } from '#components'
import ListState from '../../../src/runtime/templates/components/core/ui/ListState.vue'
import Pagination from '../../../src/runtime/templates/components/core/ui/Pagination.vue'
import SearchField from '../../../src/runtime/templates/components/core/ui/SearchField.vue'
import RouteListRow from '../../../src/runtime/templates/components/core/admin/RouteListRow.vue'
import KitSim from './KitSim.vue'
import KitDemo from './KitDemo.vue'
import KitLoadControls from './KitLoadControls.vue'
import { kitLoader } from './fake-loader'
import { kitListPage, kitRoutes } from './fake-routes'
import type { KitRouteRow } from './fake-routes'

type Answer = 'results' | 'empty' | 'error'

const PER_PAGE = 20
const now = new Date()
const answer = ref<Answer>('results')
const size = ref<'short' | 'long'>('short')
const search = ref<string | null>('')
const page = ref(1)
const items = ref<KitRouteRow[]>([])
const total = ref(0)
const loading = ref(false)
const loadError = ref<string>()
let request = 0

const answerOptions = [{ value: 'results', label: 'Results' }, { value: 'empty', label: 'Empty' }, { value: 'error', label: 'Error' }]
const sizeOptions = [{ value: 'short', label: '6 routes' }, { value: 'long', label: '95 routes, paged' }]
const rows = computed(() => kitRoutes(size.value === 'long' ? 95 : 6, now))
const linkFn = () => ({ hash: '#kit-sim-lists' })

async function load() {
  const id = ++request
  loading.value = true
  try {
    await kitLoader.wait()
    if (id !== request) {
      return
    }
    if (answer.value === 'error') {
      throw new Error('The server answered 500.')
    }
    const result = answer.value === 'empty' ? { items: [], total: 0 } : kitListPage(rows.value, search.value ?? '', page.value, PER_PAGE)
    items.value = result.items
    total.value = result.total
    loadError.value = undefined
  }
  catch (error) {
    if (id === request) {
      loadError.value = (error as Error).message
    }
  }
  finally {
    if (id === request) {
      loading.value = false
    }
  }
}

function reload() {
  items.value = []
  void load()
}

watch([answer, size], () => {
  page.value = 1
  reload()
})
watch(search, () => {
  page.value = 1
  void load()
})
watch(page, () => void load())
load()

const emptyTitle = computed(() => search.value?.trim() ? `No routes match “${search.value.trim()}”.` : undefined)
const stateText = computed(() => {
  if (loading.value) {
    return items.value.length ? `reloading over ${items.value.length} rows (${kitLoader.state.mode})` : `loading (${kitLoader.state.mode})`
  }
  if (loadError.value) {
    return items.value.length ? 'error, keeping the last rows' : 'error'
  }
  if (!items.value.length) {
    return emptyTitle.value ? 'no match' : 'empty'
  }
  return `page ${page.value} of ${Math.max(1, Math.ceil(total.value / PER_PAGE))}, ${total.value} routes`
})
</script>

<template>
  <KitSim
    id="kit-sim-lists"
    title="Simulation: lists"
    intro="An admin list put together from the parts ListContent uses: the error alert with Retry, the loading and empty ListState, RouteListRow rows in every route state, and Pagination. ListContent itself fetches through $cwa, so it is not mounted here. Search with “zzz” for no match."
  >
    <template #controls>
      <CwaUiSegmented
        v-model="answer"
        label="Answer"
        :options="answerOptions"
        data-testid="kit-sim-lists-answer"
      />
      <CwaUiSegmented
        v-model="size"
        label="Rows"
        :options="sizeOptions"
        data-testid="kit-sim-lists-size"
      />
      <KitLoadControls />
      <CwaUiButton
        label="Reload"
        size="sm"
        @click="reload"
      />
    </template>
    <KitDemo
      component="List (ListState, RouteListRow, Pagination)"
      :state="stateText"
      wide
    >
      <div
        class="kit-list"
        data-testid="kit-sim-lists-list"
      >
        <SearchField
          v-model="search"
          label="Search routes"
          placeholder="Search routes"
          class="kit-list-search"
        />
        <CwaUiAlert
          v-if="loadError"
          tone="danger"
          title="Routes couldn't be loaded."
          class="kit-list-alert"
        >
          <p>{{ loadError }}</p>
          <template #actions>
            <CwaUiButton
              label="Retry"
              :loading="loading"
              @click="load"
            />
          </template>
        </CwaUiAlert>
        <div
          role="table"
          aria-label="Routes"
          :aria-busy="loading ? 'true' : undefined"
          :style="{ '--cwa-list-columns': 'minmax(0,1fr) auto 3rem' }"
        >
          <div
            role="rowgroup"
            class="kit-list-head"
          >
            <div
              role="row"
              class="kit-list-head-row"
            >
              <span role="columnheader">Path</span>
              <span role="columnheader">Status</span>
              <span role="columnheader"><span class="kit-sr">Actions</span></span>
            </div>
          </div>
          <div
            role="rowgroup"
            :class="{ 'kit-list-dim': (loading || loadError) && items.length }"
          >
            <RouteListRow
              v-for="row in items"
              :key="row.resource['@id']"
              :data="row.resource"
              :link-fn="linkFn"
              :now="now"
              :associated-resources="row.associated"
            />
          </div>
        </div>
        <ListState
          v-if="loading && !items.length"
          state="loading"
          noun="routes"
        />
        <ListState
          v-else-if="!loading && !items.length && !loadError"
          state="empty"
          noun="routes"
          :title="emptyTitle"
        >
          <CwaUiButton
            v-if="search"
            label="Clear search"
            @click="search = ''"
          />
        </ListState>
        <Pagination
          v-if="items.length"
          v-model:page="page"
          :total="total"
          :per-page="PER_PAGE"
          label="Routes pages"
          class="kit-list-pages"
        />
      </div>
    </KitDemo>
  </KitSim>
</template>

<style scoped>
.kit-list {
  width: 100%;
  max-width: 72rem;
}

.kit-list-search,
.kit-list-alert {
  margin-bottom: 1rem;
}

.kit-list-head-row {
  display: grid;
  grid-template-columns: var(--cwa-list-columns);
  align-items: center;
  column-gap: 1rem;
  height: 2.5rem;
  padding: 0 1rem;
  box-shadow: inset 0 -1px 0 var(--cwa-color-line);
  color: var(--cwa-color-fg-muted);
  font-size: 0.75rem;
}

@media (width < 48rem) {
  .kit-list-head {
    display: none;
  }
}

.kit-list-dim {
  opacity: 0.6;
}

.kit-list-pages {
  margin-top: 1.5rem;
}

.kit-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
