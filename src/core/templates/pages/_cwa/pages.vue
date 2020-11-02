<template>
  <cwa-footer-logo class="cwa-layouts-page">
    <div class="container">
      <cwa-grid-header title="Pages" />
      <cwa-grid-loader />
      <cwa-pagination-bar />
    </div>
  </cwa-footer-logo>
</template>

<script>
import commonMixin from './commonMixin'
import CwaFooterLogo from '../../components/cwa-footer-logo'
import CwaGridHeader from '../../components/cwa-grid-header'
import NuxtErrorIcon from '../../components/nuxt-error-icon'
import CwaLoader from '../../cwa-loader'
import CwaGridLoader from '../../components/cwa-grid-loader'
import CwaPaginationBar from '../../cwa-pagination-bar'

export default {
  components: {CwaPaginationBar, CwaGridLoader, CwaLoader, NuxtErrorIcon, CwaGridHeader, CwaFooterLogo},
  mixins: [commonMixin],
  async mounted() {
    const { data } = await this.$axios.get('/_/layouts')
    console.log(data)
  }
}
</script>
