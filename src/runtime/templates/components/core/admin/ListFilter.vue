<template>
  <ListContainer class="cwa-py-4">
    <div class="cwa-flex cwa-space-x-8">
      <div class="cwa-flex-grow">
        <FilterFormWrapper label="Search" input-id="search-input">
          <input id="search-input" v-model="searchModel" type="text" class="cwa-transition-colors cwa-peer cwa-bg-stone-700/80 focus:cwa-bg-stone-700 cwa-rounded-lg cwa-border-none focus:cwa-ring-0 cwa-w-full">
          <CwaUiIconSearchIcon class="cwa-absolute cwa-right-2.5 cwa-top-1/2 -cwa-translate-y-1/2 cwa-w-[1.2rem] cwa-text-white/50 peer-focus:cwa-text-white cwa-transition-colors" />
        </FilterFormWrapper>
      </div>
      <div class="cwa-min-w-[150px]">
        <FilterFormWrapper label="Sort" input-id="filter-select">
          <FilterSelect v-model="orderModel" :options="options" class="flex-grow cwa-w-full" />
        </FilterFormWrapper>
      </div>
    </div>
  </ListContainer>
</template>

<script setup lang="ts">
import ListContainer from '#cwa/runtime/templates/components/core/admin/ListContainer.vue'
import FilterFormWrapper from '#cwa/runtime/templates/components/core/admin/form/FilterFormWrapper.vue'
import FilterSelect from '#cwa/runtime/templates/components/core/admin/form/FilterSelect.vue'
import { useQueryBoundModel } from '#imports'

const options = [
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

const { model: searchModel } = useQueryBoundModel('search', {
  delay: 250
})
const { model: orderModel } = useQueryBoundModel('order', {
  defaultValue: options[0].value
})
</script>
