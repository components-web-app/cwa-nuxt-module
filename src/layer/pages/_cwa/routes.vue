<template>
  <ListHeading title="Routes" :hide-add="true" />
  <ListFilter :order-options="orderOptions" :search-fields="['path']" />
  <ListContent ref="listContent" fetch-url="/_/routes">
    <template #item="{data, rawData}">
      <RouteListRow :data="data" :associated-resources="rawData.associatedResources" :link-fn="computedItemLink" @delete="deleteRoute" />
    </template>
  </ListContent>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useHead } from '#app'
import ListHeading from '#cwa/runtime/templates/components/core/admin/ListHeading.vue'
import ListContent from '#cwa/runtime/templates/components/core/admin/ListContent.vue'
import ListFilter from '#cwa/runtime/templates/components/core/admin/ListFilter.vue'
import { useListPage } from '#cwa/layer/pages/_cwa/composables/useListPage'
import { useCwa } from '#imports'
import RouteListRow from '#cwa/runtime/templates/components/core/admin/RouteListRow.vue'

const $cwa = useCwa()
const listContent = ref<InstanceType<typeof ListContent> | null>(null)
const { computedItemLink, triggerReload } = useListPage(listContent, true)

async function deleteRoute (routeIri: string) {
  await $cwa.resourcesManager.deleteResource({
    endpoint: routeIri
  })
  triggerReload()
}

const orderOptions = [
  {
    label: 'New - Old',
    value: { createdAt: 'desc' }
  },
  {
    label: 'Old - New',
    value: { createdAt: 'asc' }
  },
  {
    label: 'A - Z',
    value: { path: 'asc' }
  },
  {
    label: 'Z - A',
    value: { path: 'desc' }
  }
]

useHead({
  title: 'Routes'
})
</script>
