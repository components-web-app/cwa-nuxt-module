import Vue, { PropType } from 'vue'
import QueryParamsMixin from './QueryParamsMixin'

interface CollectionInterface {
  'hydra:collection': any[]
  'hydra:view'?: {
    '@id': string
    '@type': string
    'hydra:first': string
    'hydra:last': string
    'hydra:next': string
  }
}

export default Vue.extend({
  mixins: [QueryParamsMixin],
  props: {
    collection: {
      type: Object as PropType<CollectionInterface>,
      required: true
    }
  },
  data() {
    return {
      maxPageLinks: 5,
      pageQueryParam: 'page'
    }
  },
  computed: {
    lastPage() {
      // split the string /aaa?page=x to find the last page as number
      return this.collection &&
        this.collection['hydra:view'] &&
        this.collection['hydra:view']['hydra:last']
        ? this.collection['hydra:view']['hydra:last'].split(
            `${this.pageQueryParam}=`
          )[1] / 1
        : 1
    },
    pageNavigation() {
      let currentPageNumber = this.page
      const pageNumbers = [currentPageNumber]
      const afterTotal = Math.min(2, this.lastPage - currentPageNumber)
      const totalPageLinks = this.maxPageLinks
      currentPageNumber--
      while (
        currentPageNumber > 0 &&
        pageNumbers.length < totalPageLinks - afterTotal
      ) {
        pageNumbers.unshift(currentPageNumber)
        currentPageNumber--
      }
      currentPageNumber = this.page + 1
      while (
        currentPageNumber <= this.lastPage &&
        pageNumbers.length < totalPageLinks
      ) {
        pageNumbers.push(currentPageNumber)
        currentPageNumber++
      }
      if (pageNumbers[0] > 1) {
        pageNumbers.splice(0, 1)
      }
      if (pageNumbers[pageNumbers.length - 1] < this.lastPage) {
        pageNumbers.pop()
      }
      return pageNumbers
    },
    forceLastPageLink() {
      return this.pageNavigation[this.pageNavigation.length - 1] < this.lastPage
    },
    forceFirstPageLink() {
      return this.pageNavigation[0] > 1
    },
    page: {
      get() {
        return (this.$route.query[this.pageQueryParam] || 1) / 1 || 1
      },
      set(value) {
        this.updateQueryParams(this.pageQueryParam, value)
      }
    }
  },
  methods: {
    goToPage(page: number) {
      // @ts-ignore
      this.page = Math.max(1, Math.min(page, this.lastPage))
    }
  }
})
