<template>
  <cwa-footer-logo class="cwa-layouts-page">
    <div class="container">
      <cwa-grid-header title="Layouts" @filter="updateFilters" @add="showLayout" :highlight-add-button="!layouts.length" />
      <cwa-grid-loader :is-loading="loadingData" :total-items="layouts.length">
        <li v-for="layout of layouts" :key="layout['@id']" class="column column-33">
          <nuxt-link :to="{ name: '_cwa_layouts_iri', params: { iri: layout['@id'] }}" class="layout-grid-item">
            <p class="title">{{ layout.reference }}</p>
            <p class="subtitle">{{ layout.uiComponent }}</p>
          </nuxt-link>
        </li>
      </cwa-grid-loader>
      <cwa-pagination-bar :total="totalPages" :current="currentPage" :display-max="4" @change="changePage" />
    </div>
    <nuxt-child @close="closeModal" @change="reloadAndClose" />
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
      loadDataDebouncedFn: null,
      currentPage: 1,
      totalPages: null
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
    },
    currentPage() {
      this.loadData()
    }
  },
  methods: {
    changePage(newPage) {
      this.currentPage = newPage
    },
    updateFilters(filters) {
      const newFilters = {}
      if (filters.order) {
        for (const [key, value] of Object.entries(filters.order)) {
          newFilters[`order[${key}]`] = value
        }
      }
      if (filters.search) {
        newFilters[`reference`] = filters.search
        newFilters[`uiComponent`] = filters.search
      }
      this.filters = newFilters
    },
    async loadData() {
      this.loadingData = true
      const filters = Object.assign({
        page: this.currentPage
      }, this.filters)
      const queryString = Object.keys(filters).map((key) => {
        return encodeURIComponent(key) + '=' + encodeURIComponent(filters[key])
      }).join('&')
      const endpoint = `/_/layouts?${queryString}`
      const { data } = await this.$axios.get(endpoint)
      this.loadingData = false
      this.layouts = data['hydra:member']

      const hydraView = data['hydra:view']
      if (!hydraView) {
        this.totalPages = null
      } else {
        this.totalPages = hydraView['hydra:last'].split('page=')[1].split('&')[0] / 1
      }
    },
    showLayout(iri = 'add') {
      this.$router.push({ name: '_cwa_layouts_iri', params: { iri }})
    },
    async reloadAndClose() {
      await this.loadData()
      await this.closeModal()
    },
    async closeModal() {
      await this.$router.push({ name: '_cwa_layouts' })
    }
  }
}
</script>

<style lang="sass">
.cwa-layouts-page
  .layout-grid-item
    position: relative
    background: $cwa-navbar-background
    padding: 2rem 7rem 2rem 2rem
    display: block
    color: $cwa-color-text-light
    &:after
      content: ''
      position: absolute
      top: 0
      right: 0
      width: 7rem
      height: 100%
      background: url("../../../assets/images/icon-layout.svg") 0 50% no-repeat
      opacity: .6
      transition: .25s
    &:hover,
    &:focus
      color: $white
      &:after
        opacity: 1
    p
      margin: 0
      &.title
        font-size: 2rem
      &.subtitle
        font-size: inherit
</style>
