<template>
  <cwa-footer-logo class="cwa-layouts-page">
    <div class="container">
      <cwa-grid-header
        title="Layouts"
        @add="showLayout"
        :highlight-add-button="!layouts.length"
        :order-parameter="orderParameter"
        :search-fields="searchFields"
        :page-parameter="pageParameter"
      />
      <cwa-grid-loader :is-loading="loadingData" :total-items="layouts.length">
        <li v-for="layout of layouts" :key="layout['@id']" class="column column-33">
          <nuxt-link :to="{ name: '_cwa_layouts_iri', params: { iri: layout['@id'] }}" class="layout-grid-item">
            <p class="title">{{ layout.reference }}</p>
            <p class="subtitle">{{ layout.uiComponent }}</p>
          </nuxt-link>
        </li>
      </cwa-grid-loader>
      <cwa-pagination-bar :total="totalPages" :page-parameter="pageParameter" :display-max="5" />
    </div>
    <nuxt-child @close="closeModal" @change="reloadAndClose" />
  </cwa-footer-logo>
</template>

<script>
import commonMixin from './common-mixin'
import CwaFooterLogo from '../../components/cwa-footer-logo'
import CwaGridHeader from '../../components/cwa-grid-header'
import NuxtErrorIcon from '../../components/nuxt-error-icon'
import CwaLoader from '../../components/cwa-loader'
import CwaGridLoader from '../../components/cwa-grid-loader'
import CwaPaginationBar from '../../components/cwa-pagination-bar'
import CwaNuxtLink from '../../components/cwa-nuxt-link'
import QueryHelperMixin from '../../../mixins/QueryHelperMixin'

export default {
  components: {CwaNuxtLink, CwaPaginationBar, CwaGridLoader, CwaLoader, NuxtErrorIcon, CwaGridHeader, CwaFooterLogo},
  mixins: [commonMixin, QueryHelperMixin],
  data() {
    return {
      loadingData: false,
      layouts: [],
      loadDataDebouncedFn: null,
      currentPage: 1,
      totalPages: null,
      pageParameter: 'page',
      orderParameter: 'order',
      searchFields: ['reference', 'uiComponent'],
      lastQuerystring: null
    }
  },
  watch: {
    '$route.query': {
      immediate: true,
      deep: true,
      handler() {
        this.loadData()
      }
    }
  },
  created() {
    this.loadData()
  },
  methods: {
    async loadData(forceReload = false) {
      const passthroughQuery = this.getFilteredQuery([this.pageParameter, ...this.searchFields], [this.orderParameter])
      const queryString = Object.keys(passthroughQuery).map((key) => {
        return encodeURIComponent(key) + '=' + encodeURIComponent(passthroughQuery[key])
      }).join('&')
      const endpoint = `/_/layouts?${queryString}`
      if (!forceReload && queryString === this.lastQuerystring) {
        this.loadingData = false
        return
      }
      this.loadingData = true
      this.totalPages = null
      this.lastQuerystring = queryString
      const { data } = await this.$axios.get(endpoint)
      this.loadingData = false
      this.layouts = data['hydra:member']

      const hydraView = data['hydra:view']
      if (!hydraView) {
        this.totalPages = null
      } else {
        this.totalPages = hydraView['hydra:last']?.split('page=')[1]?.split('&')[0] / 1 || null
      }
    },
    showLayout(iri = 'add') {
      this.$router.push({ name: '_cwa_layouts_iri', params: { iri }, query: this.$route.query })
    },
    async reloadAndClose() {
      await this.loadData(true)
      await this.closeModal()
    },
    async closeModal() {
      await this.$router.push({ name: '_cwa_layouts', query: this.$route.query })
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
