<template>
  <cwa-footer-logo class="cwa-layouts-page">
    <div class="container">
      <cwa-grid-header title="Pages" />
      <cwa-grid-loader :is-loading="true" />
      <cwa-pagination-bar />
    </div>
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

export default {
  components: {CwaPaginationBar, CwaGridLoader, CwaLoader, NuxtErrorIcon, CwaGridHeader, CwaFooterLogo},
  mixins: [commonMixin]
}
</script>
