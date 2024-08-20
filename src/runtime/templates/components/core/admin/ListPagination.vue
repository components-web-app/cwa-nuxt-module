<template>
  <div class="cwa-flex cwa-justify-between cwa-items-center">
    <div class="cwa-text-stone-400">
      {{ showingFrom }} to {{ showingTo }} of {{ totalItems }} results
    </div>
    <div>
      <ul class="cwa-flex cwa-bg-dark cwa-rounded-lg cwa-overflow-hidden cwa-border cwa-border-stone-600">
        <ListPaginationButton :disabled="isFirst" @click="pageModel--">
          &lt;
        </ListPaginationButton>
        <ListPaginationButton>
          1
        </ListPaginationButton>
        <ListPaginationButton>
          2
        </ListPaginationButton>
        <ListPaginationButton>
          3
        </ListPaginationButton>
        <ListPaginationButton>
          ...
        </ListPaginationButton>
        <ListPaginationButton>
          8
        </ListPaginationButton>
        <ListPaginationButton>
          9
        </ListPaginationButton>
        <ListPaginationButton>
          10
        </ListPaginationButton>
        <ListPaginationButton :disabled="isLast" @click="pageModel++">
          &gt;
        </ListPaginationButton>
      </ul>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import ListPaginationButton from './ListPaginationButton.vue'

const props = defineProps<{
  totalItems: number
}>()
const pageModel = defineModel<number>('page', { required: true })
const perPageModel = defineModel<number>('perPage', { required: true })

const showingFrom = computed(() => {
  return 1 + ((pageModel.value - 1) * perPageModel.value)
})
const showingTo = computed(() => {
  return Math.min(props.totalItems, showingFrom.value - 1 + perPageModel.value)
})
const isFirst = computed(() => {
  return pageModel.value <= 1
})
const isLast = computed(() => {
  return showingTo.value === props.totalItems
})
</script>
