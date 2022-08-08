<template>
  <cwa-footer-logo class="cwa-layouts-page">
    <grid-page
      ref="gridPage"
      title="Layouts"
      endpoint="/_/layouts"
      @load="updateData"
      @add="showAddPage"
    >
      <li v-for="layout of data" :key="layout['@id']" class="column column-33">
        <nuxt-link
          :to="addRouteProps(layout['@id'])"
          class="cwa-grid-item layout-grid-item"
        >
          <p class="title">
            {{ layout.reference }}
          </p>
          <p class="subtitle">UI: {{ layout.uiComponent }}</p>
        </nuxt-link>
      </li>
    </grid-page>
    <nuxt-child @close="closeModal" @change="reloadAndClose" />
  </cwa-footer-logo>
</template>

<script>
import GridPageMixin from './GridPageMixin'

export default {
  mixins: [GridPageMixin('_cwa_layouts', '_cwa_layouts_iri')],
  head() {
    return {
      title: 'Layouts'
    }
  }
}
</script>

<style lang="sass">
.cwa-layouts-page
  .layout-grid-item
    padding-right: 7rem
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
</style>
