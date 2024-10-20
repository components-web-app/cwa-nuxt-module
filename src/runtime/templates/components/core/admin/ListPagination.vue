<template>
  <div class="cwa-flex cwa-justify-between cwa-items-center">
    <div class="cwa-text-stone-400 cwa-py-1.5 cwa-text-sm">
      {{ showingFrom }} to {{ showingTo }} of {{ totalItems }} results
    </div>
    <div>
      <ul class="cwa-flex cwa-bg-dark cwa-rounded-lg cwa-overflow-hidden cwa-border cwa-border-stone-600">
        <ListPaginationButton
          :disabled="isFirst"
          @click="pageModel--"
        >
          &lt;
        </ListPaginationButton>
        <ListPaginationButton
          v-for="pageNumber of pages"
          :key="`page-change-button-${pageNumber}`"
          :selected="pageNumber === pageModel"
          @click="pageModel = pageNumber"
        >
          {{ pageNumber }}
        </ListPaginationButton>
        <ListPaginationButton
          :disabled="isLast"
          @click="pageModel++"
        >
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
const totalPages = computed(() => {
  if (!perPageModel.value) {
    return 1
  }
  return Math.ceil(props.totalItems / perPageModel.value)
})
const pages = computed(() => {
  if (!totalPages.value) {
    return []
  }
  const allPages = Array.from(Array(totalPages.value), (_, x) => x + 1)
  const maxPagesToDisplay = 7
  if (allPages.length < maxPagesToDisplay) {
    return allPages
  }

  const displayPages = []
  displayPages.push(pageModel.value)
  let lowest = pageModel.value
  let highest = pageModel.value
  let displayCounter = 1
  while (displayCounter < maxPagesToDisplay) {
    displayCounter++
    if ((displayCounter % 2 === 0 || highest >= totalPages.value) && lowest > 1) {
      lowest--
      displayPages.unshift(lowest)
      continue
    }
    if (highest < totalPages.value) {
      highest++
      displayPages.push(highest)
    }
  }
  return displayPages
})
</script>
