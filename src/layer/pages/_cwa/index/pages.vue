<template>
  <ListHeading title="Pages" />
  <ListFilter
    :order-options="orderOptions"
    search-label="Search pages"
    :count="countText"
    create-noun="page"
    @add="goToAdd"
  >
    <template #filters>
      <FilterToggle
        v-model="staticModel"
        label="Static"
        colour="static"
      />
      <FilterToggle
        v-model="dynamicModel"
        label="Dynamic"
        colour="dynamic"
      />
    </template>
  </ListFilter>
  <ListContent
    ref="listContent"
    fetch-url="/_/pages"
    noun="pages"
    :columns="columns"
    :search-fields="['reference', 'title', 'uiComponent']"
    @loaded="load"
  >
    <template #notice>
      <CwaUiAlert
        v-if="routesError"
        tone="warning"
        title="Route statuses couldn't be loaded."
        class="cwa:mb-4"
        data-testid="list-routes-error"
      >
        <template #actions>
          <CwaUiButton
            label="Retry"
            data-testid="list-routes-retry"
            @click="retryRoutes"
          />
        </template>
      </CwaUiAlert>
    </template>
    <template #item="{ data, rawData }">
      <ListRow
        :to="computedItemLink(data['@id'])"
        :view="getInternalResourceLink(data['@id'])"
        actions
        :title="data.reference"
        :type="data.isTemplate ? { label: 'Dynamic template', colour: 'dynamic' } : { label: 'Static page', colour: 'static' }"
        :sub="subLine(data)"
      >
        <template #phone>
          <PageListStatus
            :resource="data"
            :route="routes[data['@id']]"
            :known="known"
            :failed="!!routesError"
            :page-data-count="rawData._metadata?.pageDataCount"
            :now="now"
          />
          <span class="cwa:truncate">{{ subLine(data) }}</span>
        </template>
        <ListCell>
          <PageListStatus
            :resource="data"
            :route="routes[data['@id']]"
            :known="known"
            :failed="!!routesError"
            :page-data-count="rawData._metadata?.pageDataCount"
            :now="now"
          />
        </ListCell>
        <ListCell align="end">
          {{ listDate(data.modifiedAt) }}
        </ListCell>
      </ListRow>
    </template>
    <template #empty>
      <CwaUiButton
        variant="solid"
        :icon="PlusIcon"
        label="Page"
        aria-label="Create page"
        @click="goToAdd"
      />
    </template>
  </ListContent>
  <ResourceModalOverlay
    :overlay="false"
    @reload="triggerReload"
  />
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useListPage } from '#cwa-layer/_composables/useListPage'
import { useListRoutes } from '#cwa-layer/_composables/useListRoutes'
import ListHeading from '#cwa/templates/components/core/admin/ListHeading.vue'
import ListContent from '#cwa/templates/components/core/admin/ListContent.vue'
import ListFilter from '#cwa/templates/components/core/admin/ListFilter.vue'
import ListRow from '#cwa/templates/components/core/admin/ListRow.vue'
import ListCell from '#cwa/templates/components/core/admin/ListCell.vue'
import PageListStatus from '#cwa/templates/components/core/admin/PageListStatus.vue'
import { listDate } from '#cwa/templates/components/core/admin/list-date'
import ResourceModalOverlay from '#cwa/templates/components/core/admin/ResourceModalOverlay.vue'
import FilterToggle from '#cwa/templates/components/core/ui/FilterToggle.vue'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import CwaUiAlert from '#cwa/templates/components/ui/Alert.vue'
import PlusIcon from '#cwa/templates/components/ui/icon/PlusIcon.vue'
import { useQueryBoundModel } from '#cwa/composables/cwa-query-bound-model'
import type { CwaResource } from '#cwa/resources/resource-utils'
import { definePageMeta, useCwa, useCwaResourceRoute, useHead } from '#imports'

const listContent = ref<InstanceType<typeof ListContent> | null>(null)

const $cwa = useCwa()
const { goToAdd, triggerReload, computedItemLink } = useListPage(listContent)
const { getInternalResourceLink } = useCwaResourceRoute()
const { routes, known, error: routesError, now, load, retry: retryRoutes } = useListRoutes('pages')

const columns = [
  { label: 'Page' },
  { label: 'Status', width: '13rem' },
  { label: 'Updated', width: '8rem', align: 'end' as const },
  { label: 'Actions', width: '4.5rem', labelHidden: true },
]

const orderOptions = [
  { label: 'Newest first', value: { createdAt: 'desc' } },
  { label: 'Oldest first', value: { createdAt: 'asc' } },
  { label: 'A to Z', value: { reference: 'asc' } },
  { label: 'Z to A', value: { reference: 'desc' } },
]

const { model: selectedTypesModel } = useQueryBoundModel('isTemplate[]', {
  defaultValue: [],
})

function typeModel(value: string) {
  return computed({
    get: () => (selectedTypesModel.value ?? []).includes(value),
    set: (on: boolean) => {
      const others = (selectedTypesModel.value ?? []).filter((selected: string) => selected !== value)
      selectedTypesModel.value = on ? [...others, value] : others
    },
  })
}

const staticModel = typeModel('false')
const dynamicModel = typeModel('true')

const countText = computed(() => {
  const total = listContent.value?.total
  return typeof total === 'number' ? `${total} ${total === 1 ? 'page' : 'pages'}` : undefined
})

function subLine(page: CwaResource) {
  const path = routes.value[page['@id']]?.path
  if (path) {
    return path
  }
  return `UI: ${page.uiComponent ? getDisplayPageUi(page.uiComponent) : 'Unknown'}`
}

function getDisplayPageUi(ui: string) {
  const cleanName = ui.replace(/^CwaPage/, '')
  return $cwa.pagesConfig?.[cleanName]?.name || cleanName
}

useHead({
  title: 'Pages',
})

definePageMeta({
  name: '_cwa-pages',
  pageTransition: false,
})
</script>
