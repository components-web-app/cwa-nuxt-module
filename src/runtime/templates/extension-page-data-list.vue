<template>
  <CwaAdminList
    v-if="list && endpoints"
    :title="list.label"
    :fetch-url="endpoints"
    :noun="list.label.toLowerCase()"
    :columns="columns"
    :order-options="orderOptions"
    :search-label="`Search ${list.label.toLowerCase()}`"
  >
    <template #item="{ data, link }">
      <ListRow
        :to="link"
        :title="data.title || 'Untitled'"
        :sub="typeName(data['@type'])"
      >
        <ListCell
          v-for="column in list.columns"
          :key="column.label"
        >
          <component
            :is="column.component"
            :data="data"
          />
        </ListCell>
      </ListRow>
    </template>
  </CwaAdminList>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import CwaAdminList from '#cwa/templates/components/main/admin/List.vue'
import ListRow from '#cwa/templates/components/core/admin/ListRow.vue'
import ListCell from '#cwa/templates/components/core/admin/ListCell.vue'
import { useCwa } from '#cwa/composables/cwa'
import { pageDataTypesWithProperty } from '#cwa/admin/extension-page-data'
import type { ExtensionPageDataList } from '#cwa/admin/extension-page-data'
// @ts-ignore
import { extensionPageDataLists } from '#build/cwa-extension-page-data'

const $cwa = useCwa()
const route = useRoute()

const list = computed(() => (extensionPageDataLists as Record<string, ExtensionPageDataList>)[String(route.name).replace(/-iri$/, '')])
const endpoints = ref<string[]>()

const columns = computed(() => [{ label: 'Title' }, ...(list.value?.columns ?? []).map(column => ({ label: column.label }))])

const orderOptions = [
  { label: 'Newest first', value: { createdAt: 'desc' } },
  { label: 'Oldest first', value: { createdAt: 'asc' } },
  { label: 'A to Z', value: { title: 'asc' } },
  { label: 'Z to A', value: { title: 'desc' } },
]

function typeName(type: string | undefined) {
  const className = type?.split('\\').pop()
  return (className && $cwa.pageDataConfig?.[className]?.name) || className
}

onMounted(async () => {
  const property = list.value?.property
  if (!property) {
    return
  }
  endpoints.value = pageDataTypesWithProperty(await $cwa.getApiDocumentation(), property).map(type => type.endpoint)
})
</script>
