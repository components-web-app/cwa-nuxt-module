<template>
  <div>
    <div class="cwa-header row is-mobile">
      <div class="column is-narrow">
        <h1>{{ title }}</h1>
      </div>
      <div class="column is-narrow">
        <cwa-add-button @click="$emit('add')" :highlight="highlightAddButton" />
      </div>
    </div>
    <div class="cwa-filter-bar row cwa-input">
      <div class="column is-narrow">
        <input type="text" name="search" placeholder="Search" v-model="search" :class="{'has-content': search}" />
      </div>
      <div class="column is-narrow">
        <div class="select">
          <select name="order" v-model="order">
            <option v-for="(op, index) of orderOptions" :key="`orderOption${index}`" :value="op[1]">{{op[0]}}</option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import CwaAddButton from './cwa-add-button'
import VueRouter from 'vue-router'
import QueryHelperMixin from '../../mixins/QueryHelperMixin'
const { isNavigationFailure, NavigationFailureType } = VueRouter

export default {
  mixins: [QueryHelperMixin],
  components: {CwaAddButton},
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
    orderOptions: {
      type: Array,
      default() {
        return [
          ['New - Old', { createdAt: 'desc' }],
          ['Old - New', { createdAt: 'asc'}],
          ['A - Z', { reference: 'asc' }],
          ['Z - A ', { reference: 'desc' }]
        ]
      }
    }
  },
  data() {
    return {
      search: '',
      order: this.orderOptions[0][1],
      filterQuery: {}
    }
  },
  mounted() {
    this.updateFromCurrentRoute()
  },
  watch: {
    '$route.query'() {
      this.updateFromCurrentRoute()
    },
    order(newParameter, oldParameter) {
      const oldEntries = Object.entries(oldParameter)
      const oldParam = `${this.orderParameter}[${oldEntries[0][0]}]`
      if (this.filterQuery[oldParam]) {
        this.$delete(this.filterQuery, oldParam)
      }

      const entries = Object.entries(newParameter)
      this.$set(this.filterQuery, `${this.orderParameter}[${entries[0][0]}]`, entries[0][1])
      this.updateQuerystring()
    },
    search(newSearch) {
      if (!newSearch) {
        this.$delete(this.filterQuery, 'reference')
        this.$delete(this.filterQuery, 'uiComponent')
      } else {
        this.$set(this.filterQuery, 'reference', newSearch)
        this.$set(this.filterQuery, 'uiComponent', newSearch)
      }
      this.updateQuerystring()
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
  methods: {
    updateQuerystring() {
      const query = Object.assign({}, this.$route.query, this.filterQuery)
      this.$router.replace({ query }).catch(failure => {
        if (isNavigationFailure(failure, NavigationFailureType.duplicated)) {
          return
        }
        throw failure
      })
    },
    updateFromCurrentRoute() {
      if (Object.keys(this.$route.query).length === 0) {
        this.search = ''
        this.order = this.orderOptions[0][1]
        return
      }
      this.filterQuery = this.getFilteredQuery(this.searchFields, [this.orderParameter])

      Object.keys(this.filterQuery).forEach(key => {
        const isSearch = this.searchFields.indexOf(key) !== -1
        if (isSearch) {
          this.search = this.filterQuery[key]
          return
        }

        const matches = key.match(new RegExp(`^${this.orderParameter}\\[([a-zA-Z0-9]+)\]$`, 'i'))
        if (matches) {
          this.order = {}
          this.$set(this.order, matches[1], this.filterQuery[key])
        }
      })
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
