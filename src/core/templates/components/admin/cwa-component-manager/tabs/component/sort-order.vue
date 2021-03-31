<template>
  <div class="sort-order-tab">
    <div class="row">
      <div class="column is-narrow">
        <cwa-admin-toggle
          :id="`component-sort-${resource['@id']}`"
          v-model="draggableToggled"
          label="Drag & drop"
        />
      </div>
      <div class="column is-narrow">
        <cm-text
          :id="`component-sort-number-${componentPosition['@id']}`"
          :iri="componentPosition['@id']"
          field="sortValue"
          type="number"
          label="Sort value"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import ComponentManagerTabMixin from '../../../../../../mixins/ComponentManagerTabMixin'
import CwaAdminToggle from '../../../input/cwa-admin-toggle.vue'
import CmText from '../../input/cm-text.vue'

export default {
  components: { CmText, CwaAdminToggle },
  mixins: [ComponentManagerTabMixin],
  data() {
    return {
      draggableToggled: false
    }
  },
  computed: {
    componentPosition() {
      return this.$cwa.getResource(this.context.componentPosition)
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
}
</script>

<style lang="sass">
// .sort-order-tab
</style>
