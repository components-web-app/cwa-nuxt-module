<template>
  <ListHeading
    title="Pages"
    @add="goToAdd"
  />
  <ListFilter
    :order-options="orderOptions"
    :search-fields="['reference', 'title', 'uiComponent']"
  />
  <ListContainer>
    <div>
      <div>
        <FilterFormWrapper
          label="Page Type"
          input-id="page-type"
        >
          <div class="cwa:flex cwa:gap-x-2">
            <div>
              <ListFilterButton
                v-model="selectedTypesModel"
                value="false"
                label="Static"
                background-color-class="cwa:bg-blue-600/20"
                border-color-class="cwa:border-blue-600"
              />
            </div>
            <div>
              <ListFilterButton
                v-model="selectedTypesModel"
                value="true"
                label="Dynamic"
                background-color-class="cwa:bg-yellow/20"
                border-color-class="cwa:border-yellow"
              />
            </div>
          </div>
        </FilterFormWrapper>
      </div>
    </div>
  </ListContainer>
  <ListContent
    ref="listContent"
    fetch-url="/_/pages"
  >
    <template #item="{ data }">
      <div class="cwa:flex cwa:border-b cwa:border-b-stone-700 cwa:py-6 cwa:gap-x-4 cwa:items-center">
        <div class="cwa:grow cwa:flex cwa:flex-col cwa:gap-y-1">
          <div class="cwa:flex cwa:items-center cwa:gap-x-3">
            <span class="cwa:text-xl">{{ data.reference }}</span><span :class="['cwa:outline', 'cwa:outline-1', 'cwa:outline-offset-2', 'cwa:w-2', 'cwa:h-2', 'cwa:rounded-full', data.isTemplate ? 'cwa:outline-yellow cwa:bg-yellow' : 'cwa:outline-blue-600 cwa:bg-blue-600']" />
          </div>
          <span class="cwa:text-stone-400">UI: {{ data.uiComponent ? getDisplayPageUi(data.uiComponent) : 'Unknown' }}</span>
        </div>
        <div class="cwa:flex cwa:gap-x-2">
          <CwaUiFormButton :to="computedItemLink(data['@id'])">
            <CwaUiIconCogIcon class="cwa:w-6" />
            <span class="cwa:sr-only">Settings</span>
          </CwaUiFormButton>
          <CwaUiFormButton @click="() => goToPage(data['@id'])">
            <CwaUiIconEyeIcon class="cwa:h-5" />
            <span class="cwa:sr-only">View</span>
          </CwaUiFormButton>
        </div>
      </div>
    </template>
  </ListContent>
  <ResourceModalOverlay @reload="triggerReload" />
</template>

<script lang="ts" setup>
import { useRouter } from 'vue-router'
import { ref } from 'vue'
import { useListPage } from './composables/useListPage'
import { useHead } from '#app'
import ListHeading from '#cwa/runtime/templates/components/core/admin/ListHeading.vue'
import ListContent from '#cwa/runtime/templates/components/core/admin/ListContent.vue'
import ListFilter from '#cwa/runtime/templates/components/core/admin/ListFilter.vue'
import ListContainer from '#cwa/runtime/templates/components/core/admin/ListContainer.vue'
import FilterFormWrapper from '#cwa/runtime/templates/components/core/admin/form/FilterFormWrapper.vue'
import ListFilterButton from '#cwa/runtime/templates/components/core/admin/ListFilterButton.vue'
import { useQueryBoundModel } from '#cwa/runtime/composables/cwa-query-bound-model'
import ResourceModalOverlay from '#cwa/runtime/templates/components/core/admin/ResourceModalOverlay.vue'
import { definePageMeta, useCwa, useCwaResourceRoute } from '#imports'

const listContent = ref<InstanceType<typeof ListContent> | null>(null)

const $cwa = useCwa()
const { goToAdd, triggerReload, computedItemLink } = useListPage(listContent)
const { getInternalResourceLink } = useCwaResourceRoute()

const router = useRouter()

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

const { model: selectedTypesModel } = useQueryBoundModel('isTemplate[]', {
  defaultValue: ['true', 'false'],
})

function goToPage(page: string) {
  router.push(getInternalResourceLink(page))
}

function getDisplayPageUi(ui: string) {
  return $cwa.pagesConfig?.[ui]?.name || ui
}

useHead({
  title: 'Pages',
})

definePageMeta({
  name: '_cwa-pages',
  pageTransition: false,
})
</script>
