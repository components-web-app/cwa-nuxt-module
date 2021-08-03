import Vue, { PropType } from 'vue'
import debounce from 'lodash.debounce'
import QueryParamsMixin from './QueryParamsMixin'

export default Vue.extend({
  mixins: [QueryParamsMixin],
  props: {
    searchFields: {
      type: Array as PropType<string[]>,
      required: true
    }
  },
  data() {
    return {
      searchValue: this.$route.query[this.searchFields[0]] || null,
      debouncedQueryUpdate: null
    }
  },
  methods: {
    updateSearch(immediate: boolean = false) {
      if (this.searchValue === '') {
        this.searchValue = null
      }
      const updateSearch = () => {
        this.updateQueryParams(this.searchFields, this.searchValue)
      }
      if (this.debouncedQueryUpdate) {
        this.debouncedQueryUpdate.cancel()
      }
      if (immediate === false) {
        this.debouncedQueryUpdate = debounce(updateSearch, 250)
        this.debouncedQueryUpdate()
      } else {
        updateSearch()
      }
    }
  }
})
