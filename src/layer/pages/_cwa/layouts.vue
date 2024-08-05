<template>
  <ListHeading title="Layouts" />
  <ListFilter :order-options="orderOptions" :search-fields="['reference', 'uiComponent']" />
  <ListContent fetch-url="/_/layouts">
    <template #item="data">
      <div class="cwa-flex cwa-border-b cwa-border-b-stone-700 cwa-py-4 cwa-space-x-4 cwa-items-center">
        <div class="cwa-grow cwa-flex cwa-flex-col cwa-space-y-1">
          <span class="cwa-text-xl">{{ data.reference }}</span>
          <span class="cwa-text-stone-400">UI: {{ getDisplayLayoutUi(data.uiComponent) }}</span>
        </div>
        <div>
          <CwaUiFormButton :to="{ name: '_cwa-layouts-iri', params: { iri: data['@id'] }, query: route.query }">
            <CwaUiIconCogIcon class="cwa-w-6" />
            <span class="cwa-sr-only">Settings</span>
          </CwaUiFormButton>
        </div>
      </div>
    </template>
  </ListContent>
  <ResourceModalOverlay />
</template>

<script lang="ts" setup>
import { useHead } from '#app'
import { useRoute } from 'vue-router'
import ListHeading from '#cwa/runtime/templates/components/core/admin/ListHeading.vue'
import ListContent from '#cwa/runtime/templates/components/core/admin/ListContent.vue'
import ListFilter from '#cwa/runtime/templates/components/core/admin/ListFilter.vue'
import ResourceModalOverlay from '#cwa/runtime/templates/components/core/admin/ResourceModalOverlay.vue'

const route = useRoute()

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
    value: { reference: 'asc' }
  },
  {
    label: 'Z - A',
    value: { reference: 'desc' }
  }
]

function getDisplayLayoutUi (ui: string) {
  return ui.replace(/CwaLayout/, '')
}

useHead({
  title: 'Layouts'
})
</script>
