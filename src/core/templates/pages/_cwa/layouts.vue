<template>
  <cwa-footer-logo class="cwa-layouts-page">
    <grid-page
      title="Layouts"
      ref="gridPage"
      endpoint="/_/layouts"
      @load="updateData"
      @add="showAddPage"
    >
      <li v-for="layout of data" :key="layout['@id']" class="column column-33">
        <nuxt-link :to="addRouteProps(layout['@id'])" class="layout-grid-item">
          <p class="title">{{ layout.reference }}</p>
          <p class="subtitle">{{ layout.uiComponent }}</p>
        </nuxt-link>
      </li>
    </grid-page>
    <nuxt-child @close="closeModal" @change="reloadAndClose" />
  </cwa-footer-logo>
</template>

<script>
import GridPageMixin from './GridPageMixin'

export default {
  mixins: [GridPageMixin('_cwa_layouts', '_cwa_layouts_iri')]
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
