<template>
  <ListHeading :title="pageDataClassName">
    <NuxtLink
      :to="{ name: '_cwa-data' }"
      data-testid="list-back"
      class="cwa:mb-2 cwa:inline-flex cwa:min-h-6 cwa:items-center cwa:gap-1 cwa:text-label cwa:text-fg-muted cwa:outline-1 cwa:outline-transparent cwa:hover:text-fg cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg"
    >
      <ChevronGlyph class="cwa:size-2.5 cwa:rotate-90" />
      Page data
    </NuxtLink>
  </ListHeading>
  <ListFilter
    :order-options="orderOptions"
    :search-label="`Search ${pluralName}`"
    :count="countText"
    :create-noun="singularName"
    @add="goToAdd"
  />
  <ListContent
    v-if="endpoint"
    ref="listContent"
    :fetch-url="endpoint"
    :noun="pluralName"
    :columns="columns"
    :search-fields="['title']"
    @loaded="load"
  >
    <template #item="{ data }">
      <ListRow
        :to="computedItemLink(data['@id'])"
        :title="data.title || 'Untitled'"
        :sub="subLine(data)"
      >
        <template #phone>
          <PageListStatus
            :resource="data"
            :route="routes[data['@id']]"
            :known="known"
            :now="now"
          />
          <span class="cwa:truncate">{{ subLine(data) }}</span>
        </template>
        <ListCell>
          <PageListStatus
            :resource="data"
            :route="routes[data['@id']]"
            :known="known"
            :now="now"
          />
        </ListCell>
        <ListCell align="end">
          {{ listDate(data.modifiedAt) }}
        </ListCell>
      </ListRow>
    </template>
    <template #empty>
      <CwaUiButton
        variant="solid"
        :icon="PlusIcon"
        :label="capitalise(singularName)"
        :aria-label="`Create ${singularName}`"
        @click="goToAdd"
      />
    </template>
  </ListContent>
  <ResourceModalOverlay
    :overlay="false"
    @reload="triggerReload"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from 'vue'
import { pageDataNoun } from '#cwa/templates/components/core/admin/page-data-noun'
import ListHeading from '#cwa/templates/components/core/admin/ListHeading.vue'
import ListFilter from '#cwa/templates/components/core/admin/ListFilter.vue'
import ListContent from '#cwa/templates/components/core/admin/ListContent.vue'
import ListRow from '#cwa/templates/components/core/admin/ListRow.vue'
import ListCell from '#cwa/templates/components/core/admin/ListCell.vue'
import PageListStatus from '#cwa/templates/components/core/admin/PageListStatus.vue'
import { listDate } from '#cwa/templates/components/core/admin/list-date'
import ResourceModalOverlay from '#cwa/templates/components/core/admin/ResourceModalOverlay.vue'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import PlusIcon from '#cwa/templates/components/ui/icon/PlusIcon.vue'
import ChevronGlyph from '#cwa/templates/components/core/ui/ChevronGlyph.vue'
import { useDataList } from '#cwa-layer/_composables/useDataList'
import { useListPage } from '#cwa-layer/_composables/useListPage'
import { useListRoutes } from '#cwa-layer/_composables/useListRoutes'
import { useDataType } from '#cwa-layer/_composables/useDataType'
import { useDynamicPageLoader } from '#cwa-layer/_composables/useDynamicPageLoader'
import type { CwaResource } from '#cwa/resources/resource-utils'
import { definePageMeta, useCwa, useHead } from '#imports'

const listContent = ref<InstanceType<typeof ListContent> | null>(null)

const $cwa = useCwa()
const { pageDataClassName, dataType, dataTypeClassName, pageDataConfig } = useDataType()

const { goToAdd, triggerReload, computedItemLink } = useListPage(listContent)
const { loadDynamicPageOptions, dynamicPages } = useDynamicPageLoader()
const { routes, known, now, load } = useListRoutes('pageData')

const endpoint = ref<string>()

const columns = [
  { label: 'Title' },
  { label: 'Status', width: '13rem' },
  { label: 'Updated', width: '8rem', align: 'end' as const },
]

const orderOptions = [
  { label: 'Newest first', value: { createdAt: 'desc' } },
  { label: 'Oldest first', value: { createdAt: 'asc' } },
  { label: 'A to Z', value: { title: 'asc' } },
  { label: 'Z to A', value: { title: 'desc' } },
]

const singularName = computed(() => pageDataNoun(dataTypeClassName.value))
const pluralName = computed(() => pageDataConfig.value?.name?.toLowerCase() || singularName.value)

const countText = computed(() => {
  const total = listContent.value?.total
  return typeof total === 'number' ? `${total} ${pluralName.value}` : undefined
})

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

useDataList()

onMounted(async () => {
  await loadDynamicPageOptions()
})

const templateNames = computed<Record<string, string>>(() => Object.fromEntries((dynamicPages.value ?? []).map(page => [page['@id'], page.reference])))

function subLine(data: CwaResource) {
  const path = routes.value[data['@id']]?.path
  const template = templateNames.value[data.page] || data.page
  return [path, template ? `Template: ${template}` : undefined].filter(Boolean).join(' · ')
}

watchEffect(async () => {
  const docs = await $cwa.getApiDocumentation()
  if (dataType.value) {
    endpoint.value = docs?.entrypoint?.[dataType.value]
  }
})

useHead({
  title: () => {
    return pageDataClassName.value + ' - Page Data'
  },
})

definePageMeta({
  name: '_cwa-data-type',
  pageTransition: false,
})
</script>
