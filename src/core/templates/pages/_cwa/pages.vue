<template>
  <cwa-footer-logo class="cwa-pages-page">
    <grid-page
      title="Pages"
      ref="gridPage"
      endpoint="/_/pages"
      :search-fields="['reference', 'uiComponent', 'title', 'layout.reference']"
      @load="updateData"
      @add="showAddPage"
    >
      <li v-for="page of data" :key="page['@id']" class="column column-33">
        <div class="cwa-grid-item page-grid-item">
          <nuxt-link :to="addRouteProps(page['@id'])">
            <p class="title">{{ page.reference }}</p>
            <p class="subtitle">UI: {{ page.uiComponent }}</p>
            <p class="subtitle">Layout: {{ layouts ? (layouts[page.layout] || 'Unknown') : 'Loading' }}</p>
          </nuxt-link>
          <nuxt-link :to="{ name: '_cwa_page_iri', params: { iri: page['@id'] } }" class="builder-link">
            <img src="../../../assets/images/icon-builder.svg" />
            <span>Builder</span>
          </nuxt-link>
        </div>
      </li>
    </grid-page>
    <nuxt-child @close="closeModal" @change="reloadAndClose" />
  </cwa-footer-logo>
</template>

<script>
import GridPageMixin from './GridPageMixin'
import LoadLayoutsMixin from './LoadLayoutsMixin'

export default {
  mixins: [GridPageMixin('_cwa_pages', '_cwa_pages_iri'), LoadLayoutsMixin]
}
</script>

<style lang="sass">
.cwa-pages-page
  .page-grid-item
    .builder-link
      display: flex
      background: $cwa-navbar-background
      padding: 1.2rem 2rem
      vertical-align: middle
      img
        margin-right: 1rem
</style>
