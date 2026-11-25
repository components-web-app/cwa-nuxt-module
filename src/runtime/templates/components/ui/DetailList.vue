<script setup lang="ts">
export interface DetailItem {
  label: string
  value?: string | number | null
}

const { items } = defineProps<{
  items: DetailItem[]
}>()

defineSlots<{
  value?: (props: { item: DetailItem, index: number }) => unknown
}>()

function isEmpty(value: DetailItem['value']) {
  return value === undefined || value === null || value === ''
}
</script>

<template>
  <div
    data-testid="detail-list"
    class="cwa:@container"
  >
    <dl
      class="cwa:m-0 cwa:grid cwa:grid-cols-1 cwa:gap-x-4 cwa:gap-y-stack"
      :class="{ 'cwa:@lg:grid-cols-2': items.length > 1 }"
    >
      <div
        v-for="(item, index) in items"
        :key="index"
        data-testid="detail-list-item"
        class="cwa:min-w-0"
      >
        <dt class="cwa:text-label cwa:text-fg">
          {{ item.label }}
        </dt>
        <dd class="cwa:m-0 cwa:mt-1.5 cwa:break-words cwa:text-control cwa:text-fg-secondary">
          <slot
            name="value"
            :item="item"
            :index="index"
          >
            <template v-if="isEmpty(item.value)">
              <span aria-hidden="true">—</span>
              <span class="cwa:sr-only">Not set</span>
            </template>
            <template v-else>
              {{ item.value }}
            </template>
          </slot>
        </dd>
      </div>
    </dl>
  </div>
</template>
