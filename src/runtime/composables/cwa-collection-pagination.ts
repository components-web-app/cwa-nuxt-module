import { computed } from 'vue'

export type CwaPaginationProps = {
  currentPage: number
  totalPages: number
  maxPagesToDisplay: number
}

export type CwaPaginationEmits = {
  next: []
  previous: []
  change: [value: number]
}
export const useCwaCollectionPagination = (props: CwaPaginationProps) => {
  const pages = computed(() => {
    if (!props.totalPages) {
      return []
    }
    const allPages = Array.from(Array(props.totalPages), (_, x) => x + 1)
    const maxPagesToDisplay = 7
    if (allPages.length < maxPagesToDisplay) {
      return allPages
    }

    const displayPages = []
    displayPages.push(props.currentPage)
    let lowest = props.currentPage
    let highest = props.currentPage
    let displayCounter = 1
    while (displayCounter < maxPagesToDisplay) {
      displayCounter++
      if ((displayCounter % 2 === 0 || highest >= props.totalPages) && lowest > 1) {
        lowest--
        displayPages.unshift(lowest)
        continue
      }
      if (highest < props.totalPages) {
        highest++
        displayPages.push(highest)
      }
    }
    return displayPages
  })

  return {
    pages,
  }
}
