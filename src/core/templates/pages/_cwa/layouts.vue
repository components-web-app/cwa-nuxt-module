<template>
  <cwa-footer-logo class="cwa-layouts-page">
    <div class="container">
      <cwa-grid-header title="Layouts" @filter="updateFilters" @add="addNewLayout" />
      <cwa-grid-loader :is-loading="loadingData">
        <ul v-if="layouts.length">
          <li v-for="layout of layouts" :key="layout['@id']">
            {{ layout }}
          </li>
        </ul>
      </cwa-grid-loader>
      <cwa-pagination-bar />
    </div>
    <nuxt-child @close="closeModal" />
  </cwa-footer-logo>
</template>

<script>
import debounce from 'lodash.debounce'
import commonMixin from './commonMixin'
import CwaFooterLogo from '../../components/cwa-footer-logo'
import CwaGridHeader from '../../components/cwa-grid-header'
import NuxtErrorIcon from '../../components/nuxt-error-icon'
import CwaLoader from '../../components/cwa-loader'
import CwaGridLoader from '../../components/cwa-grid-loader'
import CwaPaginationBar from '../../components/cwa-pagination-bar'

export default {
  components: {CwaPaginationBar, CwaGridLoader, CwaLoader, NuxtErrorIcon, CwaGridHeader, CwaFooterLogo},
  mixins: [commonMixin],
  data() {
    return {
      loadingData: true,
      layouts: [],
      filters: null,
      loadDataDebouncedFn: null
    }
  },
  watch: {
    filters(_, oldFilters) {
      this.loadingData = true
      if (this.loadDataDebouncedFn) {
        this.loadDataDebouncedFn.cancel()
      }
      this.loadDataDebouncedFn = debounce(this.loadData, oldFilters ? 500 : 0)
      this.loadDataDebouncedFn()
    }
  },
  methods: {
    updateFilters(filters) {
      this.filters = filters
    },
    async loadData() {
      this.loadingData = true
      const queryString = Object.keys(this.filters).map((key) => {
        return encodeURIComponent(key) + '=' + encodeURIComponent(this.filters[key])
      }).join('&')
      const endpoint = `/_/layouts?${queryString}`
      const { data } = await this.$axios.get(endpoint)
      this.loadingData = false
      this.layouts = data['hydra:member']
    },
    addNewLayout() {
      this.$router.push({ name: '_cwa_layouts_id', params: { id: 'add' }})
    },
    closeModal() {
      this.$router.push({ name: '_cwa_layouts' })
    }
  }
}
</script>
