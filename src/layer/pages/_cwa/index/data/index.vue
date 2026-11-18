<template>
  <ListHeading title="Page data" />
  <div class="cwa:mx-auto cwa:w-full cwa:max-w-6xl cwa:px-4 cwa:pb-12 cwa:sm:px-8">
    <div
      role="table"
      aria-label="Page data types"
      :aria-busy="isLoadingDataTypes ? 'true' : undefined"
      style="--cwa-list-columns: minmax(0,1fr)"
    >
      <div
        role="rowgroup"
        class="cwa:max-md:hidden"
      >
        <div
          role="row"
          class="cwa:flex cwa:h-10 cwa:items-center cwa:border-b cwa:border-line cwa:px-4"
        >
          <span
            role="columnheader"
            class="cwa:text-helper cwa:text-fg-muted"
          >Type</span>
        </div>
      </div>
      <div role="rowgroup">
        <ListRow
          v-for="pageData of dataTypes"
          :key="pageData['@id']"
          :to="{ name: '_cwa-data-type', params: { type: fqcnToEntrypointKey(pageData.resourceClass) } }"
          :title="displayPageDataClassName(pageData.resourceClass)"
        />
      </div>
    </div>
    <ListState
      v-if="isLoadingDataTypes"
      state="loading"
      noun="page data types"
      :rows="3"
    />
    <ListState
      v-else-if="!dataTypes.length"
      state="empty"
      noun="page data types"
      description="A page data type is defined in the API."
    />
  </div>
</template>

<script setup lang="ts">
import ListHeading from '#cwa/templates/components/core/admin/ListHeading.vue'
import ListRow from '#cwa/templates/components/core/admin/ListRow.vue'
import ListState from '#cwa/templates/components/core/ui/ListState.vue'
import { useDataList } from '#cwa-layer/_composables/useDataList'
import { definePageMeta, useHead } from '#imports'

const { displayPageDataClassName, dataTypes, fqcnToEntrypointKey, isLoadingDataTypes } = useDataList()

useHead({
  title: 'Page Data Categories',
})

definePageMeta({
  name: '_cwa-data',
  pageTransition: false,
})
</script>
