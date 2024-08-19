<template>
  <ListHeading title="Page Data Categories" :hide-add="true" />
  <ListContainer>
    <ul class="cwa-my-6 cwa-flex cwa-flex-col cwa-space-y-4">
      <li v-for="pageData of dataTypes" :key="pageData['@id']">
        <NuxtLink :to="{ name: '_cwa-data-type', params: { type: pageData.resourceClass } }" class="cwa-flex cwa-p-4 cwa-border cwa-border-stone-700 cwa-py-6 cwa-space-x-4 cwa-items-center cwa-bg-dark/80 hover:cwa-bg-dark cwa-cursor-pointer cwa-transition-colors">
          <div class="cwa-grow cwa-flex cwa-flex-col cwa-space-y-1">
            <div class="cwa-flex cwa-items-center cwa-space-x-3">
              <span class="cwa-text-xl">{{ displayPageDataClassName(pageData.resourceClass) }}</span>
            </div>
          </div>
          <div class="cwa-flex cwa-space-x-2">
            <CwaUiFormButton>
              <CwaUiIconArrowIcon class="cwa-w-5 -cwa-rotate-90 cwa-my-2" />
              <span class="cwa-sr-only">View</span>
            </CwaUiFormButton>
          </div>
        </NuxtLink>
      </li>
    </ul>
  </ListContainer>
</template>

<script setup lang="ts">
import { useHead } from '#app'
import ListHeading from '#cwa/runtime/templates/components/core/admin/ListHeading.vue'
import ListContainer from '#cwa/runtime/templates/components/core/admin/ListContainer.vue'
import { useDataList } from '#cwa/layer/pages/_cwa/composables/useDataList'
const { displayPageDataClassName, dataTypes } = useDataList()

useHead({
  title: 'Page Data Categories'
})
</script>
