<template>
  <ListContainer class="cwa-py-4">
    <div class="cwa-flex cwa-space-x-8">
      <div class="cwa-flex-grow">
        <FilterFormWrapper label="Search">
          <input type="text" class="cwa-transition-colors cwa-peer cwa-bg-light/10 focus:cwa-bg-light/15 cwa-rounded-lg cwa-border-none focus:cwa-ring-0 cwa-w-full">
          <CwaUiIconSearchIcon class="cwa-absolute cwa-right-2.5 cwa-top-1/2 -cwa-translate-y-1/2 cwa-w-[1.2rem] cwa-text-white/50 peer-focus:cwa-text-white cwa-transition-colors" />
        </FilterFormWrapper>
      </div>
      <div>
        <FilterFormWrapper label="Sort">
          Input here
        </FilterFormWrapper>
      </div>
    </div>
  </ListContainer>
</template>

<script setup lang="ts">
import ListContainer from '#cwa/runtime/templates/components/core/admin/ListContainer.vue'
import FilterFormWrapper from '#cwa/runtime/templates/components/core/admin/form/FilterFormWrapper.vue'
</script>
