<template>
  <div class="primary-layout">
    <div class="top">
      <cwa-admin-bar />
      <div class="refresh-bar-holder">
        <cwa-refresh-bar />
      </div>

      <div v-if="$cwa.$state.error" class="container loading-message">
        <p class="error">
          {{ $cwa.$state.error }}
        </p>
      </div>

      <nuxt />
    </div>
    <div class="bottom">
      <cwa-component-manager />
    </div>
  </div>
</template>

<script>
import LayoutMixin from '@cwa/nuxt-module/core/mixins/LayoutMixin'
import CwaRefreshBar from '@cwa/nuxt-module/core/templates/components/admin/cwa-refresh-bar.vue'
import CwaComponentManager from '@cwa/nuxt-module/core/templates/components/admin/cwa-component-manager.vue'

export default {
  components: { CwaComponentManager, CwaRefreshBar },
  mixins: [LayoutMixin]
}
</script>

<style lang="sass" scoped>
.primary-layout
  display: flex
  min-height: 100vh
  flex-direction: column
  > .top
    flex-grow: 1
    .refresh-bar-holder
      position: relative
  .loading-message
    .error
      color: $color-danger
</style>
