<template>
  <NuxtPage v-if="route.params.type" />
  <div
    v-else-if="list && types?.length !== 1"
    class="cwa:mx-auto cwa:w-full cwa:max-w-6xl cwa:px-4 cwa:pb-12 cwa:sm:px-8"
  >
    <div
      role="table"
      :aria-label="`${list.label} types`"
      :aria-busy="!types ? 'true' : undefined"
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
          v-for="type of types"
          :key="type.key"
          :to="{ name: `${listName}-type`, params: { type: type.key } }"
          :title="pageDataTypeName($cwa, type.className)"
        />
      </div>
    </div>
    <ListState
      v-if="!types"
      state="loading"
      :noun="`${list.label.toLowerCase()} types`"
      :rows="3"
    />
    <ListState
      v-else-if="!types.length"
      state="empty"
      :noun="list.label.toLowerCase()"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ListRow from '#cwa/templates/components/core/admin/ListRow.vue'
import ListState from '#cwa/templates/components/core/ui/ListState.vue'
import { useCwa } from '#cwa/composables/cwa'
import { pageDataTypeName, pageDataTypesWithProperty } from '#cwa/admin/extension-page-data'
import type { ExtensionPageDataList } from '#cwa/admin/extension-page-data'
// @ts-ignore
import { extensionPageDataLists } from '#build/cwa-extension-page-data'

const $cwa = useCwa()
const route = useRoute()
const router = useRouter()

const listName = computed(() => String(route.meta.cwaPageDataList))
const list = computed(() => (extensionPageDataLists as Record<string, ExtensionPageDataList>)[listName.value])
const types = ref<ReturnType<typeof pageDataTypesWithProperty>>()

watch([types, () => route.params.type], ([found, type]) => {
  if (found?.length === 1 && !type) {
    router.replace({ name: `${listName.value}-type`, params: { type: found[0]!.key }, query: route.query })
  }
})

onMounted(async () => {
  const property = list.value?.property
  types.value = property ? pageDataTypesWithProperty(await $cwa.getApiDocumentation(), property) : []
})
</script>
