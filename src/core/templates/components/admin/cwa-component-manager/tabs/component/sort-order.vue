<template>
  <div class="sort-order-tab">
    <div class="row">
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
      const collectionIri = this.context.collection.iri
      if (!collectionIri) {
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
// .sort-order-tab
</style>
