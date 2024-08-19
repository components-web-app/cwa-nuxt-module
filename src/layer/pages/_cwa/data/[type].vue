<template>
  <ListHeading :title="pageDataClassName" @add="goToAdd" />
  <ListFilter :order-options="orderOptions" :search-fields="['title']" />
  <ListContent v-if="endpoint" ref="listContent" :fetch-url="endpoint">
    <template #item="data">
      <div class="cwa-flex cwa-border-b cwa-border-b-stone-700 cwa-py-6 cwa-space-x-4 cwa-items-center">
        <div class="cwa-grow cwa-flex cwa-flex-col cwa-space-y-1">
          <div class="cwa-flex cwa-items-center cwa-space-x-3">
            <span class="cwa-text-xl">{{ data.title }}</span><span :class="['cwa-outline', 'cwa-outline-1', 'cwa-outline-offset-2', 'cwa-w-2', 'cwa-h-2', 'cwa-rounded-full', data.route ? ['cwa-outline-green', 'cwa-bg-green'] : ['cwa-outline-orange', 'cwa-bg-orange']]" />
          </div>
          <span class="cwa-text-stone-400">{{ pageDataById[data.page]?.reference || data.page }}</span>
        </div>
        <div class="cwa-flex cwa-space-x-2">
          <CwaUiFormButton :to="computedItemLink(data['@id'])">
            <CwaUiIconCogIcon class="cwa-w-6" />
            <span class="cwa-sr-only">Settings</span>
          </CwaUiFormButton>
          <CwaUiFormButton @click="() => goToPage(data['@id'])">
            <CwaUiIconEyeIcon class="cwa-h-5" />
            <span class="cwa-sr-only">View</span>
          </CwaUiFormButton>
        </div>
      </div>
    </template>
  </ListContent>
  <ResourceModalOverlay @reload="triggerReload" />
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { useHead } from '#app'
import ListHeading from '#cwa/runtime/templates/components/core/admin/ListHeading.vue'
import { useCwa } from '#imports'
import { useDataList } from '#cwa/layer/pages/_cwa/composables/useDataList'
import ListFilter from '#cwa/runtime/templates/components/core/admin/ListFilter.vue'
import ResourceModalOverlay from '#cwa/runtime/templates/components/core/admin/ResourceModalOverlay.vue'
import ListContent from '#cwa/runtime/templates/components/core/admin/ListContent.vue'
import { useListPage } from '#cwa/layer/pages/_cwa/composables/useListPage'
import { useDataType } from '#cwa/layer/pages/_cwa/composables/useDataType'
import { useDynamicPageLoader } from '#cwa/layer/pages/_cwa/composables/useDynamicPageLoader'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'

const listContent = ref<InstanceType<typeof ListContent> | null>(null)

const $cwa = useCwa()
const router = useRouter()
const { pageDataClassName, dataTypeCamelCase } = useDataType()

const { goToAdd, triggerReload, computedItemLink } = useListPage(listContent)
const { loadDynamicPageOptions, dynamicPages } = useDynamicPageLoader()

const endpoint = ref<string>()

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
    value: { title: 'asc' }
  },
  {
    label: 'Z - A',
    value: { title: 'desc' }
  }
]

function goToPage (page: string) {
  router.push(page)
}

// to force the loading of api documentation
useDataList()

onMounted(async () => {
  await loadDynamicPageOptions()
})

const pageDataById = computed(() => {
  if (!dynamicPages.value) {
    return {}
  }
  return dynamicPages.value.reduce((obj, resource) => {
    obj[resource['@id']] = { ...resource }
    return obj
  }, {} as { [iri: string]: CwaResource })
})

watchEffect(async () => {
  const docs = await $cwa.getApiDocumentation()
  if (dataTypeCamelCase.value) {
    endpoint.value = docs?.entrypoint?.[dataTypeCamelCase.value]
  }
})

useHead({
  title: () => {
    return pageDataClassName.value + ' - Page Data'
  }
})
</script>
