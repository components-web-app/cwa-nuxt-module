<template>
  <ListHeading title="Routes" :hide-add="true" />
  <ListFilter :order-options="orderOptions" :search-fields="['path']" />
  <ListContent ref="listContent" fetch-url="/_/routes">
    <template #item="data">
      <div class="cwa-flex cwa-border-b cwa-border-b-stone-700 cwa-py-4 cwa-space-x-4 cwa-items-center">
        <div class="cwa-grow cwa-flex cwa-flex-col cwa-space-y-1">
          <span class="cwa-text-xl cwa-truncate">{{ data.path }}</span>
          <span v-if="getAssociatedIri(data)" class="cwa-truncate cwa-text-stone-400">{{ getAssociatedIri(data) }}</span>
          <span v-else-if="data.redirect" class="cwa-truncate cwa-text-stone-400">Redirects to: {{ data.redirect }}</span>
          <span v-else class="cwa-truncate cwa-text-red-500">This route has no association and should be deleted</span>
        </div>
        <div v-if="getAssociatedIri(data)">
          <CwaUiFormButton :to="computedItemLink(getAssociatedIri(data), '_cwa-pages', '#routes')">
            <CwaUiIconCogIcon class="cwa-w-6" />
            <span class="cwa-sr-only">Settings</span>
          </CwaUiFormButton>
        </div>
      </div>
    </template>
  </ListContent>
</template>

<script lang="ts" setup>
import { useHead } from '#app'
import { ref } from 'vue'
import ListHeading from '#cwa/runtime/templates/components/core/admin/ListHeading.vue'
import ListContent from '#cwa/runtime/templates/components/core/admin/ListContent.vue'
import ListFilter from '#cwa/runtime/templates/components/core/admin/ListFilter.vue'
import { useListPage } from '#cwa/layer/pages/_cwa/composables/useListPage'

const listContent = ref<InstanceType<typeof ListContent> | null>(null)
const { computedItemLink } = useListPage(listContent)

function getAssociatedIri (data: any) {
  return data.page || data.pageData
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
  title: 'Users'
})
</script>
