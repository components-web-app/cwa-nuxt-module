<template>
  <ListHeading title="Routes" :hide-add="true" />
  <ListFilter :order-options="orderOptions" :search-fields="['path']" />
  <ListContent ref="listContent" fetch-url="/_/routes">
    <template #item="data">
      <div class="cwa-flex cwa-border-b cwa-border-b-stone-700 cwa-py-4 cwa-space-x-4 cwa-items-center">
        <div class="cwa-grow cwa-flex cwa-flex-col cwa-space-y-1 cwa-min-w-0">
          <span class="cwa-text-xl cwa-truncate">{{ data.path }}</span>
          <span v-if="data.redirect || getAssociatedIri(data)" class="cwa-text-stone-400">
            <span class="cwa-inline-flex cwa-max-w-full cwa-bg-dark cwa-p-2 cwa-font-bold cwa-space-x-2">
              <IconRoutes v-if="data.redirect" class="cwa-w-5" />
              <IconPages v-else class="cwa-w-5" />
              <span class="cwa-truncate">{{ data.redirect || getAssociatedIri(data) }}</span>
            </span>
          </span>
          <span v-else class="cwa-truncate cwa-text-magenta cwa-font-bold">This route has no association and should be deleted</span>
        </div>
        <div>
          <CwaUiFormButton v-if="getAssociatedIri(data)" :to="computedItemLink(getAssociatedIri(data), '_cwa-pages', '#routes')">
            <IconPages class="cwa-w-6" />
            <span class="cwa-sr-only">Settings</span>
          </CwaUiFormButton>
          <CwaUiFormButton v-else-if="!data.redirect" color="blue" @click="deleteRoute(data['@id'])">
            <CwaUiIconBinIcon class="cwa-w-4 cwa-m-1" />
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
import IconPages from '#cwa/runtime/templates/components/core/assets/IconPages.vue'
import IconRoutes from '#cwa/runtime/templates/components/core/assets/IconRoutes.vue'
import { useCwa } from '#imports'

const $cwa = useCwa()
const listContent = ref<InstanceType<typeof ListContent> | null>(null)
const { computedItemLink, triggerReload } = useListPage(listContent)

function getAssociatedIri (data: any) {
  return data.page || data.pageData
}

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
  title: 'Users'
})
</script>
