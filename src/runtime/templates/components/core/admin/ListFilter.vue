<template>
  <div
    class="cwa:mx-auto cwa:w-full cwa:max-w-6xl cwa:px-4 cwa:pb-4 cwa:sm:px-8"
    data-testid="list-toolbar"
  >
    <div class="cwa:flex cwa:flex-col cwa:gap-3 cwa:md:flex-row cwa:md:items-center">
      <div class="cwa:flex cwa:gap-3 cwa:md:contents">
        <div class="cwa:min-w-0 cwa:flex-1 cwa:md:max-w-sm">
          <SearchField
            v-model="searchModel"
            :label="searchLabel"
          />
        </div>
        <CwaUiButton
          v-if="createNoun"
          variant="solid"
          :icon="PlusIcon"
          :label="capitalise(createNoun)"
          :aria-label="`Create ${createNoun}`"
          class="cwa:md:order-last"
          data-testid="list-create"
          @click="$emit('add')"
        />
      </div>
      <div class="cwa:flex cwa:items-center cwa:gap-3 cwa:max-md:-mx-4 cwa:max-md:overflow-x-auto cwa:max-md:px-4 cwa:max-md:[scrollbar-width:none]">
        <slot name="filters" />
        <CwaUiSelect
          v-model="sortModel"
          label="Sort"
          label-hidden
          width="sm"
          :options="sortOptions"
        />
      </div>
      <p
        v-if="count"
        data-testid="list-count"
        class="cwa:m-0 cwa:ms-auto cwa:whitespace-nowrap cwa:text-helper cwa:tabular-nums cwa:text-fg-muted cwa:max-md:hidden"
      >
        {{ count }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import isEqual from 'lodash-es/isEqual'
import SearchField from '#cwa/templates/components/core/ui/SearchField.vue'
import CwaUiSelect from '#cwa/templates/components/ui/Select.vue'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import PlusIcon from '#cwa/templates/components/ui/icon/PlusIcon.vue'
import { useQueryBoundModel } from '#cwa/composables/cwa-query-bound-model'

const props = defineProps<{
  orderOptions: { label: string, value: Record<string, string | undefined> }[]
  searchLabel: string
  count?: string
  createNoun?: string
}>()

defineEmits<{
  add: []
}>()

defineSlots<{
  filters?(): any
}>()

const { model: searchModel } = useQueryBoundModel('search', {
  delay: 250,
})

const { model: orderModel } = useQueryBoundModel('order', {
  defaultValue: props.orderOptions[0]?.value,
})

const sortOptions = computed(() => props.orderOptions.map((option, index) => ({ label: option.label, value: String(index) })))

const sortModel = computed({
  get: () => {
    const index = props.orderOptions.findIndex(option => isEqual(option.value, orderModel.value))
    return String(index === -1 ? 0 : index)
  },
  set: (key: string | null | undefined) => {
    const option = props.orderOptions[Number(key)]
    option && (orderModel.value = option.value)
  },
})

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
</script>
