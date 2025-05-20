<template>
  <ListContainer class="cwa:py-4">
    <div class="cwa:flex cwa:gap-x-8">
      <div class="cwa:grow">
        <FilterFormWrapper
          label="Search"
          input-id="search-input"
        >
          <input
            id="search-input"
            v-model="searchModel"
            type="text"
            class="cwa:transition-colors cwa:border-0 cwa:focus:ring-0 cwa:outline-0 cwa:peer cwa:bg-stone-700/80 cwa:focus:bg-stone-700 cwa:rounded-lg cwa:w-full"
          >
          <CwaUiIconSearchIcon class="cwa:absolute cwa:right-2.5 cwa:top-1/2 cwa:-translate-y-1/2 cwa:w-[1.2rem] cwa:text-white/50 cwa:peer-focus:text-white cwa:transition-colors" />
        </FilterFormWrapper>
      </div>
      <div class="cwa:min-w-[150px]">
        <FilterFormWrapper
          label="Sort"
          input-id="filter-select"
        >
          <FilterSelect
            v-model="orderModel"
            :options="orderOptions"
            class="flex-grow cwa:w-full"
          />
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

const props = defineProps<{
  searchFields: string[]
  orderOptions: { label: string, value: any }[]
}>()

const { model: searchModel } = useQueryBoundModel(props.searchFields, {
  delay: 250,
})

const { model: orderModel } = useQueryBoundModel('order', {
  defaultValue: props.orderOptions[0].value,
})
</script>
