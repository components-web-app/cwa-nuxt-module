<template>
  <ListHeading
    title="Page Data Categories"
    :hide-add="true"
  />
  <ListContainer>
    <div class="cwa-relative">
      <Transition
        appear
        mode="out-in"
        enter-from-class="cwa-transform cwa-opacity-0"
        enter-active-class="cwa-duration-200 cwa-ease-out"
        enter-to-class="cwa-opacity-100"
        leave-from-class="cwa-opacity-100"
        leave-active-class="cwa-duration-200 cwa-ease-in"
        leave-to-class="cwa-transform cwa-opacity-0"
      >
        <Spinner
          v-if="isLoadingDataTypes"
          class="cwa-absolute cwa-top-5"
          :show="true"
        />
        <div
          v-else-if="!dataTypes.length"
          class="cwa-flex cwa-justify-center"
        >
          <div class="cwa-w-full cwa-max-w-xl cwa-text-center cwa-flex cwa-flex-col cwa-space-y-2 cwa-text-stone-400">
            <div class="cwa-flex cwa-justify-center">
              <CwaUiIconWarningIcon class="cwa-w-20" />
            </div>
            <h2 class="cwa-font-bold">
              Sorry, no items found
            </h2>
          </div>
        </div>
        <ul
          v-else
          class="cwa-my-6 cwa-flex cwa-flex-col cwa-space-y-4"
        >
          <li
            v-for="pageData of dataTypes"
            :key="pageData['@id']"
          >
            <NuxtLink
              :to="{ name: '_cwa-data-type', params: { type: fqcnToEntrypointKey(pageData.resourceClass) } }"
              class="cwa-flex cwa-p-4 cwa-border cwa-border-stone-700 cwa-py-6 cwa-space-x-4 cwa-items-center cwa-bg-dark/80 hover:cwa-bg-dark cwa-cursor-pointer cwa-transition-colors"
            >
              <div class="cwa-grow cwa-flex cwa-flex-col cwa-space-y-1">
                <div class="cwa-flex cwa-items-center cwa-space-x-3">
                  <span class="cwa-text-xl">{{ displayPageDataClassName(pageData.resourceClass) }}</span>
                </div>
              </div>
              <div class="cwa-flex cwa-space-x-2">
                <CwaUiFormButton class="cwa-pointer-events-none">
                  <CwaUiIconArrowIcon class="cwa-w-5 -cwa-rotate-90 cwa-my-2" />
                  <span class="cwa-sr-only">View</span>
                </CwaUiFormButton>
              </div>
            </NuxtLink>
          </li>
        </ul>
      </Transition>
    </div>
  </ListContainer>
</template>

<script setup lang="ts">
import { useHead } from '#app'
import ListHeading from '#cwa/runtime/templates/components/core/admin/ListHeading.vue'
import ListContainer from '#cwa/runtime/templates/components/core/admin/ListContainer.vue'
import { useDataList } from '#cwa/layer/pages/_cwa/composables/useDataList'
import Spinner from '#cwa/runtime/templates/components/utils/Spinner.vue'

const { displayPageDataClassName, dataTypes, fqcnToEntrypointKey, isLoadingDataTypes } = useDataList()

useHead({
  title: 'Page Data Categories',
})
</script>
