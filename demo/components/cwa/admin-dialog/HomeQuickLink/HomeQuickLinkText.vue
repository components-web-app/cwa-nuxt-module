<template>
  <div class="home-quick-link-text-tab">
    <div class="columns tab-row">
      <div class="column is-narrow">
        <cm-text :id="`title-${iri}`" :iri="iri" field="title" label="Title" />
      </div>
      <div class="column">
        <cm-text
          :id="`description-${iri}`"
          :iri="iri"
          field="description"
          label="Description"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import ComponentManagerTabMixin from '@cwa/nuxt-module/core/mixins/ComponentManagerTabMixin'
import CmText from '@cwa/nuxt-module/core/templates/components/admin/cwa-component-manager/input/cm-text.vue'

export default Vue.extend({
  components: { CmText },
  mixins: [ComponentManagerTabMixin]
})
</script>

<style lang="sass">
.home-quick-link-text-tab
  width: 100%
  .cwa-component-manager-input
    width: 100%
    > .control
      flex-grow: 1
</style>
