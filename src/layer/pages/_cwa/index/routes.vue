<template>
  <ListHeading title="Routes" />
  <ListFilter
    :order-options="orderOptions"
    search-label="Search routes"
    :count="countText"
  />
  <ListContent
    ref="listContent"
    fetch-url="/_/routes"
    noun="routes"
    :columns="columns"
    :search-fields="['path']"
    @loaded="now = new Date()"
  >
    <template #item="{ data, rawData }">
      <RouteListRow
        :data="data"
        :associated-resources="rawData.associatedResources"
        :link-fn="computedItemLink"
        :now="now"
        @delete="deleteRoute"
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
import { useListPage } from '#cwa-layer/_composables/useListPage'
import { definePageMeta, useCwa, useHead } from '#imports'
import RouteListRow from '#cwa/templates/components/core/admin/RouteListRow.vue'
import ResourceModalOverlay from '#cwa/templates/components/core/admin/ResourceModalOverlay.vue'

const $cwa = useCwa()
const listContent = ref<InstanceType<typeof ListContent> | null>(null)
const { computedItemLink, triggerReload } = useListPage(listContent, true)
const now = ref(new Date())

const columns = [
  { label: 'Path' },
  { label: 'Status', width: '17.5rem' },
  { label: 'Actions', width: '4.5rem', labelHidden: true },
]

const countText = computed(() => {
  const total = listContent.value?.total
  return typeof total === 'number' ? `${total} ${total === 1 ? 'route' : 'routes'}` : undefined
})

async function deleteRoute(routeIri: string) {
  await $cwa.resourcesManager.deleteResource({ endpoint: routeIri })
  triggerReload()
}

const orderOptions = [
  { label: 'Newest first', value: { createdAt: 'desc' } },
  { label: 'Oldest first', value: { createdAt: 'asc' } },
  { label: 'A to Z', value: { path: 'asc' } },
  { label: 'Z to A', value: { path: 'desc' } },
]

useHead({ title: 'Routes' })

definePageMeta({
  name: '_cwa-routes',
  pageTransition: false,
})
</script>
