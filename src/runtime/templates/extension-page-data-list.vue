<template>
  <CwaAdminList
    v-if="list && endpoint"
    :title="name"
    :fetch-url="endpoint"
    :noun="name.toLowerCase()"
    :columns="columns"
    :order-options="orderOptions"
    :search-label="`Search ${name.toLowerCase()}`"
  >
    <template #item="{ data, link }">
      <ListRow
        :to="link"
        :title="data.title || 'Untitled'"
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
import { pageDataTypeName, pageDataTypesWithProperty } from '#cwa/admin/extension-page-data'
import type { ExtensionPageDataList } from '#cwa/admin/extension-page-data'
// @ts-ignore
import { extensionPageDataLists } from '#build/cwa-extension-page-data'

const $cwa = useCwa()
const route = useRoute()

const list = computed(() => (extensionPageDataLists as Record<string, ExtensionPageDataList>)[String(route.meta.cwaPageDataList)])
const typeKey = computed(() => String(route.params.type ?? ''))
const name = computed(() => pageDataTypeName($cwa, typeKey.value.charAt(0).toUpperCase() + typeKey.value.slice(1)))
const endpoint = ref<string>()

const columns = computed(() => [{ label: 'Title' }, ...(list.value?.columns ?? []).map(column => ({ label: column.label }))])

const orderOptions = [
  { label: 'Newest first', value: { createdAt: 'desc' } },
  { label: 'Oldest first', value: { createdAt: 'asc' } },
  { label: 'A to Z', value: { title: 'asc' } },
  { label: 'Z to A', value: { title: 'desc' } },
]

onMounted(async () => {
  const property = list.value?.property
  if (property) {
    endpoint.value = pageDataTypesWithProperty(await $cwa.getApiDocumentation(), property).find(type => type.key === typeKey.value)?.endpoint
  }
})
</script>
