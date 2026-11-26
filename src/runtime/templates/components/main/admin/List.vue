<template>
  <ListHeading
    v-if="!inArea"
    :title="title"
  />
  <div
    v-else-if="$slots.back"
    class="cwa:mx-auto cwa:w-full cwa:max-w-6xl cwa:px-4 cwa:sm:px-8"
  >
    <slot name="back" />
  </div>
  <ListFilter
    :order-options="orderOptions"
    :search-label="searchLabel"
    :count="countText"
    :create-noun="createNoun"
    @add="goToAdd"
  >
    <template
      v-if="$slots.filters"
      #filters
    >
      <slot name="filters" />
    </template>
  </ListFilter>
  <ListContent
    ref="listContent"
    :fetch-url="fetchUrl"
    :noun="noun"
    :columns="columns"
  >
    <template #notice>
      <slot name="notice" />
    </template>
    <template #item="{ data, rawData }">
      <slot
        name="item"
        v-bind="{ data, rawData, link: computedItemLink(data['@id']) }"
      />
    </template>
    <template #empty>
      <slot name="empty">
        <CwaUiButton
          v-if="createNoun"
          variant="solid"
          :icon="PlusIcon"
          :label="capitalise(createNoun)"
          :aria-label="`Create ${createNoun}`"
          data-testid="list-empty-create"
          @click="goToAdd"
        />
      </slot>
    </template>
  </ListContent>
  <ResourceModalOverlay
    :overlay="false"
    @reload="triggerReload"
  />
</template>

<script lang="ts" setup>
import { computed, inject, ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import ListHeading from '#cwa/templates/components/core/admin/ListHeading.vue'
import ListContent from '#cwa/templates/components/core/admin/ListContent.vue'
import type { ListColumn } from '#cwa/templates/components/core/admin/ListContent.vue'
import ListFilter from '#cwa/templates/components/core/admin/ListFilter.vue'
import ResourceModalOverlay from '#cwa/templates/components/core/admin/ResourceModalOverlay.vue'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import PlusIcon from '#cwa/templates/components/ui/icon/PlusIcon.vue'
import { useListPage } from '#cwa-layer/_composables/useListPage'
import type { CwaResource } from '#cwa/resources/resource-utils'
import { useHead } from '#imports'
import { areaHeadingKey } from '#cwa/templates/components/core/ui/field-keys'

const props = defineProps<{
  title: string
  fetchUrl: string
  noun: string
  createNoun?: string
  columns: ListColumn[]
  orderOptions: { label: string, value: Record<string, string | undefined> }[]
  searchLabel: string
}>()

defineSlots<{
  item(props: { data: CwaResource, rawData: CwaResource, link: RouteLocationRaw }): any
  back?(): any
  filters?(): any
  notice?(): any
  empty?(): any
}>()

const inArea = inject(areaHeadingKey, false)

const listContent = ref<InstanceType<typeof ListContent> | null>(null)

const { goToAdd, triggerReload, computedItemLink } = useListPage(listContent)

const total = computed(() => listContent.value?.total)

const countText = computed(() => {
  const count = total.value
  if (typeof count !== 'number') {
    return undefined
  }
  return `${count} ${count === 1 && props.createNoun ? props.createNoun : props.noun}`
})

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

useHead({
  title: () => props.title,
})

function reload() {
  return listContent.value?.reloadItems()
}

defineExpose({
  reload,
  total,
})
</script>
