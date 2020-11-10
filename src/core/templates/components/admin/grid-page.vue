<template>
  <div class="container">
    <cwa-grid-header
      :title="title"
      :highlight-add-button="!data.length"
      :order-parameter="orderParameter"
      :search-fields="searchFields"
      :page-parameter="pageParameter"
      @add="showLayout"
      @pending="isPending => { searchPending = isPending }"
    />
    <cwa-grid-loader :is-loading="loadingData || searchPending" :total-items="data.length">
      <slot />
    </cwa-grid-loader>
    <cwa-pagination-bar :total="totalPages" :page-parameter="pageParameter" :display-max="5" />
  </div>
</template>

<script>
import CwaGridHeader from '../../components/cwa-grid-header'
import NuxtErrorIcon from '../../components/nuxt-error-icon'
import CwaLoader from '../../components/cwa-loader'
import CwaGridLoader from '../../components/cwa-grid-loader'
import CwaPaginationBar from '../../components/cwa-pagination-bar'
import CwaNuxtLink from '../../components/cwa-nuxt-link'
import QueryHelperMixin from '../../../mixins/QueryHelperMixin'
import CwaFooterLogo from '../cwa-footer-logo'

export default {
  components: {CwaNuxtLink, CwaPaginationBar, CwaGridLoader, CwaLoader, NuxtErrorIcon, CwaGridHeader, CwaFooterLogo},
  mixins: [QueryHelperMixin],
  props: {
    endpoint: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    searchFields: {
      type: Array,
      default() {
        return ['reference', 'uiComponent']
      }
    }
  },
  data() {
    return {
      loadingData: false,
      data: [],
      cancelToken: null,
      currentPage: 1,
      totalPages: 1,
      pageParameter: 'page',
      orderParameter: 'order',
      lastQuerystring: null,
      searchPending: false
    }
  },
  watch: {
    '$route.query': {
      immediate: true,
      deep: true,
      handler() {
        this.loadData()
      }
    },
    data(newData) {
      this.$emit('load', newData)
    }
  },
  methods: {
    async loadData(forceReload = false) {
      const passthroughQuery = this.getFilteredQuery([this.pageParameter, ...this.searchFields], [this.orderParameter])
      const queryString = Object.keys(passthroughQuery).map((key) => {
        return encodeURIComponent(key) + '=' + encodeURIComponent(passthroughQuery[key])
      }).join('&')
      const endpoint = `${this.endpoint}?${queryString}`
      if (!forceReload && queryString === this.lastQuerystring) {
        return
      }

      if (this.cancelToken) {
        await this.cancelToken.cancel()
      }
      this.cancelToken = this.$axios.CancelToken.source()

      this.loadingData = true
      this.totalPages = 1
      this.lastQuerystring = queryString
      try {
        const { data } = await this.$axios.get(endpoint, {
          cancelToken: this.cancelToken.token
        })
        this.data = data['hydra:member']

        const hydraView = data['hydra:view']
        if (!hydraView) {
          this.totalPages = 1
        } else {
          this.totalPages = hydraView['hydra:last']?.split('page=')[1]?.split('&')[0] / 1 || 1
        }
        this.loadingData = false
      } catch (error) {
        if (!this.$axios.isCancel(error)) {
          this.loadingData = false
          throw error
        }
      }
    },
    showLayout() {
      this.$emit('add')
    }
  }
}
</script>
