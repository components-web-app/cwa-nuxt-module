<template>
  <ListHeading
    title="Layouts"
    @add="goToAdd"
  />
  <ListFilter
    :order-options="orderOptions"
    :search-fields="['reference', 'uiComponent']"
  />
  <ListContent
    ref="listContent"
    fetch-url="/_/layouts"
  >
    <template #item="{ data }">
      <div class="cwa:flex cwa:border-b cwa:border-b-stone-700 cwa:py-6 cwa:gap-x-4 cwa:items-center">
        <div class="cwa:grow cwa:flex cwa:flex-col cwa:gap-y-1">
          <span class="cwa:text-xl">{{ data.reference }}</span>
          <span class="cwa:text-stone-400">UI: {{ data.uiComponent ? getDisplayLayoutUi(data.uiComponent) : 'Unknown' }}</span>
        </div>
        <div>
          <CwaUiFormButton :to="computedItemLink(data['@id'])">
            <CwaUiIconCogIcon class="cwa:w-6" />
            <span class="cwa:sr-only">Settings</span>
          </CwaUiFormButton>
        </div>
      </div>
    </template>
  </ListContent>
  <ResourceModalOverlay @reload="triggerReload" />
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useHead } from '#app'
import ListHeading from '#cwa/runtime/templates/components/core/admin/ListHeading.vue'
import ListContent from '#cwa/runtime/templates/components/core/admin/ListContent.vue'
import ListFilter from '#cwa/runtime/templates/components/core/admin/ListFilter.vue'
import ResourceModalOverlay from '#cwa/runtime/templates/components/core/admin/ResourceModalOverlay.vue'
import { useListPage } from '#cwa/layer/pages/_cwa/composables/useListPage'
import { definePageMeta, useCwa } from '#imports'

const listContent = ref<InstanceType<typeof ListContent> | null>(null)

const $cwa = useCwa()
const { goToAdd, triggerReload, computedItemLink } = useListPage(listContent)

const orderOptions = [
  {
    label: 'New - Old',
    value: { createdAt: 'desc' },
  },
  {
    label: 'Old - New',
    value: { createdAt: 'asc' },
  },
  {
    label: 'A - Z',
    value: { reference: 'asc' },
  },
  {
    label: 'Z - A',
    value: { reference: 'desc' },
  },
]

function getDisplayLayoutUi(ui: string) {
  return $cwa.layoutsConfig?.[ui]?.name || ui.replace(/^CwaLayout/, '')
}

useHead({
  title: 'Layouts',
})

definePageMeta({
  pageTransition: false,
})
</script>
