<template>
  <cwa-footer-logo class="cwa-pages-page">
    <grid-page
      title="Pages"
      ref="gridPage"
      endpoint="/_/pages"
      @load="updateData"
      @add="showAddPage"
    >
      <li v-for="page of data" :key="page['@id']" class="column column-33">
        <nuxt-link :to="addRouteProps(page['@id'])" class="page-grid-item">
          <p class="title">{{ page.reference }}</p>
          <p class="subtitle">{{ page.uiComponent }}</p>
        </nuxt-link>
      </li>
    </grid-page>
    <nuxt-child @close="closeModal" @change="reloadAndClose" />
  </cwa-footer-logo>
</template>

<script>
import GridPageMixin from './GridPageMixin'

export default {
  mixins: [GridPageMixin('_cwa_pages', '_cwa_pages_iri')]
}
</script>

<style lang="sass">
.cwa-pages-page

</style>
