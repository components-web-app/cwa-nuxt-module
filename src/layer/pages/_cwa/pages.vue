<template>
  <ListHeading title="Pages" />
  <ListFilter :order-options="orderOptions" :search-fields="['reference', 'title', 'uiComponent']" />
  <ListContent fetch-url="/_/pages">
    <template #item="data">
      <div class="cwa-flex cwa-border-b cwa-border-b-stone-700 cwa-py-4 cwa-space-x-4 cwa-items-center">
        <div class="cwa-grow cwa-flex cwa-flex-col cwa-space-y-1">
          <div class="cwa-flex cwa-items-center cwa-space-x-3">
            <span class="cwa-text-xl">{{ data.reference }}</span><span :class="['cwa-outline', 'cwa-outline-offset-2', 'cwa-w-2', 'cwa-h-2', 'cwa-rounded-full', data.isTemplate ? 'cwa-outline-yellow cwa-bg-yellow' : 'cwa-outline-blue-600 cwa-bg-blue-600']" />
          </div>
          <span class="cwa-text-stone-400">UI: {{ data.uiComponent }}</span>
        </div>
        <div>
          <CwaUiFormButton>
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
import ListHeading from '#cwa/runtime/templates/components/core/admin/ListHeading.vue'
import ListContent from '#cwa/runtime/templates/components/core/admin/ListContent.vue'
import ListFilter from '#cwa/runtime/templates/components/core/admin/ListFilter.vue'

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

useHead({
  title: 'Pages'
})
</script>
