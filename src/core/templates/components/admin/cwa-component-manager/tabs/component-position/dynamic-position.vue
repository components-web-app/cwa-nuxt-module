<template>
  <div class="sort-order-tab">
    <div class="row">
      <div class="column is-narrow">
        <cm-text
          :id="`page-data-prop-${iri}`"
          :iri="iri"
          field="pageDataProperty"
          label="Page data property"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import ComponentManagerTabMixin from '../../../../../../mixins/ComponentManagerTabMixin'
import CmText from '../../input/cm-text.vue'

export default Vue.extend({
  components: { CmText },
  mixins: [ComponentManagerTabMixin],
  data() {
    return {}
  }
})
</script>

<style lang="sass">
// .sort-order-tab
</style>
