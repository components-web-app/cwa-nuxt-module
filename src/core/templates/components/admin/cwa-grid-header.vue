<template>
  <div>
    <div class="cwa-header columns is-mobile">
      <div class="column is-narrow">
        <h1>{{ title }}</h1>
      </div>
      <div class="column is-narrow">
        <cwa-add-button :highlight="highlightAddButton" @click="$emit('add')" />
      </div>
    </div>
    <div class="cwa-filter-bar columns cwa-input">
      <div class="column is-narrow">
        <input
          v-model="search"
          type="text"
          name="search"
          placeholder="Search"
          :class="{ 'has-content': search }"
        />
      </div>
      <div class="column is-narrow">
        <div class="select">
          <select v-model="order" name="order">
            <option
              v-for="(op, index) of orderOptions"
              :key="`orderOption${index}`"
              :value="op[1]"
            >
              {{ op[0] }}
            </option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import debounce from 'lodash.debounce'
import VueRouter from 'vue-router'
import CwaAddButton from '../utils/cwa-add-button'
import QueryHelperMixin from '../../../mixins/QueryHelperMixin'
const { isNavigationFailure, NavigationFailureType } = VueRouter

export default {
  components: { CwaAddButton },
  mixins: [QueryHelperMixin],
  props: {
    title: {
      type: String,
      required: true
    },
    highlightAddButton: {
      type: Boolean,
      required: false,
      default: false
    },
    searchFields: {
      type: Array,
      required: true
    },
    orderParameter: {
      type: String,
      required: true
    },
    pageParameter: {
      type: String,
      required: true
    },
    orderOptions: {
      type: Array,
      default() {
        return [
          ['New - Old', { createdAt: 'desc' }],
          ['Old - New', { createdAt: 'asc' }],
          ['A - Z', { reference: 'asc' }],
          ['Z - A ', { reference: 'desc' }]
        ]
      }
    }
  },
  data() {
    return {
      search: '',
      order: {},
      filterQuery: {},
      debouncedSearchFn: null,
      initialised: false
    }
  },
  computed: {
    orderQueryParameter() {
      const entries = Object.entries(this.order)
      return {
        [`${this.orderParameter}[${entries[0][0]}]`]: entries[0][1] || null
      }
    }
  },
  watch: {
    '$route.query'() {
      this.updateFromCurrentRoute()
    },
    order(newParameter, oldParameter) {
      if (JSON.stringify(newParameter) === JSON.stringify(oldParameter)) {
        return
      }

      const oldEntries = Object.entries(oldParameter)
      if (oldEntries.length) {
        const oldParam = `${this.orderParameter}[${oldEntries[0][0]}]`
        if (this.filterQuery[oldParam]) {
          this.$set(this.filterQuery, oldParam, '')
        }
      }

      const entries = Object.entries(newParameter)
      this.$set(
        this.filterQuery,
        `${this.orderParameter}[${entries[0][0]}]`,
        entries[0][1]
      )
      this.updateQuerystring()
    },
    search(newSearch, oldSearch) {
      if (newSearch === oldSearch) {
        return
      }
      if (this.debouncedSearchFn) {
        this.debouncedSearchFn.cancel()
      }
      this.$emit('pending', true)
      this.debouncedSearchFn = debounce(this.updateSearchParams, 250)
      this.debouncedSearchFn()
    }
  },
  mounted() {
    this.updateFromCurrentRoute()
    this.initialised = true
  },
  methods: {
    async updateQuerystring() {
      const query = Object.assign({}, this.$route.query, this.filterQuery)
      if (JSON.stringify(query) !== JSON.stringify(this.$route.query)) {
        this.$set(query, this.pageParameter, 1)
      }
      Object.keys(this.filterQuery).forEach((key) => {
        if (this.filterQuery[key] === '') {
          this.$delete(query, key)
        }
      })
      try {
        await this.$router.replace({ query })
      } catch (failure) {
        if (isNavigationFailure(failure, NavigationFailureType.duplicated)) {
          return
        }
        throw failure
      } finally {
        this.$emit('pending', false)
      }
    },
    updateFromCurrentRoute() {
      this.filterQuery = this.getFilteredQuery(this.searchFields, [
        this.orderParameter
      ])
      if (Object.keys(this.filterQuery).length === 0) {
        this.search = ''
        this.order = this.orderOptions[0][1]
        return
      }

      Object.keys(this.filterQuery).forEach((key) => {
        const isSearch = this.searchFields.includes(key)
        if (isSearch) {
          this.search = this.filterQuery[key]
          return
        }

        const matches = key.match(
          new RegExp(`^${this.orderParameter}\\[([a-zA-Z0-9]+)]$`, 'i')
        )
        if (matches) {
          this.order = {}
          this.$set(this.order, matches[1], this.filterQuery[key])
        }
      })
    },
    updateSearchParams() {
      this.searchFields.forEach((key) => {
        if (!key) {
          this.$set(this.filterQuery, key, '')
        } else {
          this.$set(this.filterQuery, key, this.search)
        }
      })

      this.updateQuerystring()
    }
  }
}
</script>

<style lang="sass">

.cwa-header
  align-items: center
  h1
    margin: 0 2rem 0 0
.cwa-filter-bar
  margin-top: 2rem
  input[type=text]
    width: 100%
    min-width: 300px
    max-width: 600px
    &:focus
      color: $white
</style>
