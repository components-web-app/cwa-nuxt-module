<template>
  <div class="home-quick-link-grid">
    <div v-if="resource._metadata._isNew">Please add the grid to continue.</div>
    <component-group
      v-else
      location="grid"
      v-bind="componentGroupProps"
      :allowed-components="['/component/home_quick_links']"
      :group-class="['columns', 'is-multiline']"
      :position-class="['column is-4']"
    />
  </div>
</template>
<script lang="ts">
import Vue from 'vue'
import ComponentMixin from '@cwa/nuxt-module/core/mixins/ComponentMixin'
import ComponentGroup from '@cwa/nuxt-module/core/templates/components/core/component-group.vue'

export default Vue.extend({
  components: { ComponentGroup },
  mixins: [ComponentMixin]
})
</script>

<style lang="sass">
@import "~bulma/sass/grid/columns"

.home-quick-link-grid
  margin-top: 4rem
  .positions-container
    justify-items: center
    justify-content: center
.cwa-image
  .placeholder
    padding: 2rem
    background: $cwa-background-dark
    color: $cwa-color-text-light
    display: inline-block
  img
    max-width: 100%
    display: block
</style>
