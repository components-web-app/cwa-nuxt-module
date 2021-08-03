import Vue, { PropType } from 'vue'
import debounce from 'lodash.debounce'
import QueryParamsMixin from './QueryParamsMixin'

export default Vue.extend({
  mixins: [QueryParamsMixin],
  props: {
    queryFields: {
      type: Array as PropType<string[]>,
      required: false,
      default: null
    }
  },
  data() {
    const inputValue = this.$route.query?.[this.queryFields?.[0]] || null
    return {
      inputValue,
      debouncedQueryUpdate: null,
      defaultDelay: 0
    }
  },
  methods: {
    updateQuery(delay?: number, queryFields?: string[]) {
      if (delay === undefined) {
        delay = this.defaultDelay
      }
      if (!queryFields) {
        queryFields = this.queryFields
      }
      if (this.inputValue === '') {
        this.inputValue = null
      }
      const updateSearch = () => {
        this.updateQueryParams(queryFields, this.inputValue)
      }
      if (this.debouncedQueryUpdate) {
        this.debouncedQueryUpdate.cancel()
      }
      if (delay > 0) {
        this.debouncedQueryUpdate = debounce(updateSearch, delay)
        this.debouncedQueryUpdate()
      } else {
        updateSearch()
      }
    }
  }
})
