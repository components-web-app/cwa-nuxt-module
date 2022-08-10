<template>
  <cwa-footer-logo class="cwa-pages-page">
    <grid-page
      ref="gridPage"
      title="Pages"
      endpoint="/_/pages"
      :search-fields="['reference', 'uiComponent', 'title', 'layout.reference']"
      @load="updateData"
      @add="showAddPage"
    >
      <li v-for="page of data" :key="page['@id']" class="column is-4">
        <div class="cwa-grid-item page-grid-item">
          <nuxt-link :to="addRouteProps(page['@id'])">
            <p class="cwa-title">
              {{ page.reference }}
            </p>
            <p class="cwa-subtitle">UI: {{ page.uiComponent }}</p>
            <p class="cwa-subtitle">
              Layout:
              {{ layouts ? layouts[page.layout] || 'Unknown' : 'Loading' }}
            </p>
          </nuxt-link>
          <nuxt-link
            :to="{
              name: '_cwa_page_iri',
              params: { iri: page['@id'], cwa_force: true }
            }"
            class="builder-link"
          >
            <img src="../../../assets/images/view.svg" />
            <span>View {{ page.isTemplate ? 'Template' : 'Page' }}</span>
          </nuxt-link>
        </div>
      </li>
    </grid-page>
    <nuxt-child @close="closeModal" @change="reloadAndClose" />
  </cwa-footer-logo>
</template>

<script lang="ts">
import Vue from 'vue'
import GridPageMixin from './GridPageMixin'
import LoadLayoutsMixin from './LoadLayoutsMixin'

export default Vue.extend({
  mixins: [GridPageMixin('_cwa_pages', '_cwa_pages_iri'), LoadLayoutsMixin],
  head() {
    return {
      title: 'Pages'
    }
  }
})
</script>

<style lang="sass">
.cwa-pages-page
  .page-grid-item
    .builder-link
      display: flex
      background: $cwa-navbar-background
      padding: 1rem 1.25rem
      vertical-align: middle
      img
        margin-right: 1rem
</style>
