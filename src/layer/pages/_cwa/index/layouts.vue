<template>
  <ListHeading title="Layouts" />
  <ListFilter
    :order-options="orderOptions"
    search-label="Search layouts"
    :count="countText"
    create-noun="layout"
    @add="goToAdd"
  />
  <ListContent
    ref="listContent"
    fetch-url="/_/layouts"
    noun="layouts"
    :columns="columns"
    :search-fields="['reference', 'uiComponent']"
  >
    <template #item="{ data }">
      <ListRow
        :to="computedItemLink(data['@id'])"
        actions
        :title="data.reference || 'Untitled layout'"
        :sub="`UI: ${data.uiComponent ? getDisplayLayoutUi(data.uiComponent) : 'Unknown'}`"
      >
        <ListCell align="end">
          {{ pageCount(data) }}
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
        label="Layout"
        aria-label="Create layout"
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
import ListHeading from '#cwa/templates/components/core/admin/ListHeading.vue'
import ListContent from '#cwa/templates/components/core/admin/ListContent.vue'
import ListFilter from '#cwa/templates/components/core/admin/ListFilter.vue'
import ListRow from '#cwa/templates/components/core/admin/ListRow.vue'
import ListCell from '#cwa/templates/components/core/admin/ListCell.vue'
import { listDate } from '#cwa/templates/components/core/admin/list-date'
import ResourceModalOverlay from '#cwa/templates/components/core/admin/ResourceModalOverlay.vue'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import PlusIcon from '#cwa/templates/components/ui/icon/PlusIcon.vue'
import { useListPage } from '#cwa-layer/_composables/useListPage'
import type { CwaResource } from '#cwa/resources/resource-utils'
import { definePageMeta, useCwa, useHead } from '#imports'

const listContent = ref<InstanceType<typeof ListContent> | null>(null)

const $cwa = useCwa()
const { goToAdd, triggerReload, computedItemLink } = useListPage(listContent)

const columns = [
  { label: 'Layout' },
  { label: 'Pages', width: '5rem', align: 'end' as const },
  { label: 'Updated', width: '8rem', align: 'end' as const },
  { label: 'Actions', width: '2.5rem', labelHidden: true },
]

const orderOptions = [
  { label: 'Newest first', value: { createdAt: 'desc' } },
  { label: 'Oldest first', value: { createdAt: 'asc' } },
  { label: 'A to Z', value: { reference: 'asc' } },
  { label: 'Z to A', value: { reference: 'desc' } },
]

const countText = computed(() => {
  const total = listContent.value?.total
  return typeof total === 'number' ? `${total} ${total === 1 ? 'layout' : 'layouts'}` : undefined
})

function pageCount(layout: CwaResource) {
  return Array.isArray(layout.pages) ? layout.pages.length : ''
}

function getDisplayLayoutUi(ui: string) {
  const cleanName = ui.replace(/^CwaLayout/, '')
  return $cwa.layoutsConfig?.[cleanName]?.name || cleanName
}

useHead({
  title: 'Layouts',
})

definePageMeta({
  name: '_cwa-layouts',
  pageTransition: false,
})
</script>
