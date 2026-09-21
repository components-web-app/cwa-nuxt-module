// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { reactive } from 'vue'
import { useCwaCollectionPagination } from '#cwa/composables/cwa-collection-pagination'

describe('useCwaCollectionPagination', () => {
  describe('pages computed', () => {
    test('returns empty array when totalPages is 0', () => {
      const props = reactive({ currentPage: 1, totalPages: 0, maxPagesToDisplay: 7 })
      const { pages } = useCwaCollectionPagination(props)
      expect(pages.value).toEqual([])
    })

    test('returns all pages when total < maxPagesToDisplay', () => {
      const props = reactive({ currentPage: 1, totalPages: 5, maxPagesToDisplay: 7 })
      const { pages } = useCwaCollectionPagination(props)
      expect(pages.value).toEqual([1, 2, 3, 4, 5])
    })

    test('returns all pages when total equals maxPagesToDisplay', () => {
      const props = reactive({ currentPage: 1, totalPages: 7, maxPagesToDisplay: 7 })
      const { pages } = useCwaCollectionPagination(props)
      expect(pages.value).toEqual([1, 2, 3, 4, 5, 6, 7])
    })

    test('returns limited window of pages centred on currentPage', () => {
      const props = reactive({ currentPage: 5, totalPages: 10, maxPagesToDisplay: 5 })
      const { pages } = useCwaCollectionPagination(props)
      expect(pages.value).toHaveLength(5)
      expect(pages.value).toContain(5)
    })

    test('clamps window at the start of the range', () => {
      const props = reactive({ currentPage: 1, totalPages: 10, maxPagesToDisplay: 5 })
      const { pages } = useCwaCollectionPagination(props)
      expect(pages.value[0]).toBe(1)
      expect(pages.value).toHaveLength(5)
    })

    test('clamps window at the end of the range', () => {
      const props = reactive({ currentPage: 10, totalPages: 10, maxPagesToDisplay: 5 })
      const { pages } = useCwaCollectionPagination(props)
      expect(pages.value[pages.value.length - 1]).toBe(10)
      expect(pages.value).toHaveLength(5)
    })

    test('defaults maxPagesToDisplay to 7 when 0 is provided', () => {
      const props = reactive({ currentPage: 1, totalPages: 20, maxPagesToDisplay: 0 })
      const { pages } = useCwaCollectionPagination(props)
      expect(pages.value).toHaveLength(7)
    })

    test('pages are sorted in ascending order', () => {
      const props = reactive({ currentPage: 5, totalPages: 20, maxPagesToDisplay: 7 })
      const { pages } = useCwaCollectionPagination(props)
      for (let i = 1; i < pages.value.length; i++) {
        expect(pages.value[i]).toBeGreaterThan(pages.value[i - 1])
      }
    })

    test('reacts to prop changes', async () => {
      const props = reactive({ currentPage: 1, totalPages: 3, maxPagesToDisplay: 7 })
      const { pages } = useCwaCollectionPagination(props)
      expect(pages.value).toEqual([1, 2, 3])
      props.totalPages = 5
      expect(pages.value).toEqual([1, 2, 3, 4, 5])
    })
  })
})
