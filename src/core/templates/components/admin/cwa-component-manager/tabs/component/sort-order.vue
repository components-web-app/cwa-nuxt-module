<template>
  <div class="sort-order-tab">
    <div class="columns tab-row">
      <div class="column is-narrow">
        <cwa-admin-toggle
          :id="`component-sort-${iri}`"
          v-model="draggableToggled"
          label="Drag & drop"
        />
      </div>
      <div class="column is-narrow">
        <cm-text
          v-if="componentPosition"
          :id="`component-sort-number-${componentPosition['@id']}`"
          :iri="componentPosition['@id']"
          :refresh-endpoints="refreshEndpoints"
          field="sortValue"
          type="number"
          label="Sort value"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import consola from 'consola'
import ComponentManagerTabMixin from '../../../../../../mixins/ComponentManagerTabMixin'
import CwaAdminToggle from '../../../input/cwa-admin-toggle.vue'
import CmText from '../../input/cm-text.vue'

export default Vue.extend({
  components: { CmText, CwaAdminToggle },
  mixins: [ComponentManagerTabMixin],
  data() {
    return {
      draggableToggled: false
    }
  },
  computed: {
    componentPosition() {
      return this.context.componentPosition
        ? this.$cwa.getResource(this.context.componentPosition)
        : null
    },
    refreshEndpoints() {
      const collectionIri = this.context.collection
      if (!collectionIri) {
        consola.warn(
          `Expected to find a collection in context to refresh. Context provided:`,
          this.context,
          this.iri
        )
        return []
      }
      const collection = this.$cwa.getResource(collectionIri)
      return collection?.componentPositions || []
    }
  },
  watch: {
    draggableToggled(isDraggable) {
      this.$emit('draggable', isDraggable)
    }
  },
  beforeDestroy() {
    this.draggableToggled = false
  }
})
</script>

<style lang="sass">
.sort-order-tab
  input[type=number]
    max-width: 180px
</style>
