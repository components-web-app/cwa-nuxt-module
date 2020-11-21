<template>
  <div class="cwa-default-layout">
    <div v-if="!hideAdmin" class="top">
      <cwa-admin-bar />
    </div>
    <div class="page">
      <nuxt />
    </div>
  </div>
</template>

<script>
import CwaAdminBar from '@cwa/nuxt-module/core/templates/components/admin/cwa-admin-bar.vue'
export default {
  components: {CwaAdminBar},
  props: {
    hideAdmin: {
      type: Boolean,
      default: false
    }
  }
}
</script>

<style lang="sass">
html
  background: $cwa-color-primary
  font-family: $cwa-font-family

body,
#__nuxt,
#__layout
  min-height: 100vh

.cwa-default-layout
  height: 100vh
  display: flex
  flex-direction: column
  color: $cwa-color-text-light
  > .top
    flex-grow: 0
  > .page
    flex-grow: 1
    background: $cwa-background-dark
  a
    color: $cwa-color-text-light
    &:hover,
    &:focus
      color: $cwa-color-primary
  h1
    font-size: 3rem
    font-weight: $font-weight-light
    letter-spacing: .05em
    color: $white
</style>
