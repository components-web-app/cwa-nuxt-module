<template>
  <cwa-input-wrapper :id="id" :label="label">
    <span class="cwa-input-info-text"
      ><span class="inner">{{ value }}</span></span
    >
  </cwa-input-wrapper>
</template>

<script>
import CwaInputWrapper from './wrapper.vue'
import CwaInputMixin from '@cwa/nuxt-module/core/templates/components/admin/input/CwaInputMixin'

export default {
  components: { CwaInputWrapper },
  mixins: [CwaInputMixin]
}
</script>

<style lang="sass">
.cwa-input-info-text
  color: $cwa-color-text-light
  font-weight: $weight-light
  white-space: nowrap
  max-width: 250px
  overflow: hidden
  text-overflow: ellipsis
  > .inner
    padding: 0 .75rem
  &:hover
    color: $white
    overflow: visible
    z-index: 2
    > .inner
      display: inline-flex
      background: $cwa-navbar-background
      width: auto
</style>
