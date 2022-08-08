<template>
  <div class="cwa-default-layout">
    <div v-if="!hideAdmin" class="top">
      <cwa-admin-bar />
    </div>
    <div class="page">
      <nuxt />
    </div>
    <cwa-confirm />
  </div>
</template>

<script>
import CwaAdminBar from '@cwa/nuxt-module/core/templates/components/admin/cwa-admin-bar.vue'
import CwaConfirm from '@cwa/nuxt-module/core/templates/components/cwa-confirm.vue'
export default {
  components: { CwaConfirm, CwaAdminBar },
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
h1
  font-size: 2.5rem
  font-weight: $weight-normal
  letter-spacing: .05em
  color: $white
</style>
