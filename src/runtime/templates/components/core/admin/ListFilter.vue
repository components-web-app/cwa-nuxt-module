<template>
  <ListContainer class="cwa-py-4">
    <div class="cwa-flex cwa-space-x-8">
      <div class="cwa-flex-grow">
        <FilterFormWrapper label="Search">
          <input type="text" class="cwa-transition-colors cwa-peer cwa-bg-light/10 focus:cwa-bg-light/15 cwa-rounded-lg cwa-border-none focus:cwa-ring-0 cwa-w-full">
          <CwaUiIconSearchIcon class="cwa-absolute cwa-right-2.5 cwa-top-1/2 -cwa-translate-y-1/2 cwa-w-[1.2rem] cwa-text-white/50 peer-focus:cwa-text-white cwa-transition-colors" />
        </FilterFormWrapper>
      </div>
      <div class="cwa-min-w-[150px]">
        <FilterFormWrapper label="Sort">
          <FilterSelect v-model="orderSelect.model.value" :options="orderSelect.options.value" class="flex-grow cwa-w-full" />
        </FilterFormWrapper>
      </div>
    </div>
  </ListContainer>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ListContainer from '#cwa/runtime/templates/components/core/admin/ListContainer.vue'
import FilterFormWrapper from '#cwa/runtime/templates/components/core/admin/form/FilterFormWrapper.vue'
import { useCwaSelect } from '#imports'
import FilterSelect from '#cwa/runtime/templates/components/core/admin/form/FilterSelect.vue'

const options = [
  {
    label: 'New - Old',
    value: { createdAt: 'desc' },
    disabled: false
  },
  {
    label: 'Old - New',
    value: { createdAt: 'asc' },
    disabled: false
  },
  {
    label: 'A - Z',
    value: { reference: 'asc' },
    disabled: false
  },
  {
    label: 'Z - A',
    value: { reference: 'desc' },
    disabled: false
  }
]
const sourceModel = ref(options[0].value)
const orderSelect = useCwaSelect(sourceModel, options)
</script>
