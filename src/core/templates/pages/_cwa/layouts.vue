<template>
  <cwa-footer-logo class="cwa-layouts-page">
    <div class="container">
      <cwa-grid-header title="Layouts" @filter="updateFilters" @add="showLayout" />
      <cwa-grid-loader :is-loading="loadingData">
        <li v-for="layout of layouts" :key="layout['@id']" class="column column-33">
          <nuxt-link :to="{ name: '_cwa_layouts_iri', params: { iri: layout['@id'] }}">
            <p>{{ layout.reference }}</p>
            <p>{{ layout.uiComponent }}</p>
          </nuxt-link>
        </li>
      </cwa-grid-loader>
      <cwa-pagination-bar />
    </div>
    <nuxt-child @close="closeModal" />
  </cwa-footer-logo>
</template>

<script>
import debounce from 'lodash.debounce'
import commonMixin from './common-mixin'
import CwaFooterLogo from '../../components/cwa-footer-logo'
import CwaGridHeader from '../../components/cwa-grid-header'
import NuxtErrorIcon from '../../components/nuxt-error-icon'
import CwaLoader from '../../components/cwa-loader'
import CwaGridLoader from '../../components/cwa-grid-loader'
import CwaPaginationBar from '../../components/cwa-pagination-bar'
import CwaNuxtLink from '../../components/cwa-nuxt-link'

export default {
  components: {CwaNuxtLink, CwaPaginationBar, CwaGridLoader, CwaLoader, NuxtErrorIcon, CwaGridHeader, CwaFooterLogo},
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
    showLayout(iri = 'add') {
      this.$router.push({ name: '_cwa_layouts_iri', params: { iri }})
    },
    async closeModal() {
      await this.$router.push({ name: '_cwa_layouts' })
      await this.loadData()
    }
  }
}
</script>

<style lang="sass">
.layouts-grid
  list-style: none
</style>
