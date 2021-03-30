<template>
  <div class="sort-order-tab">
    <div class="row">
      <div class="column is-narrow">
        <cwa-admin-toggle
          id="component-sort"
          v-model="draggableToggled"
          label="Drag & drop"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import ComponentManagerTabMixin from '../../../../../../mixins/ComponentManagerTabMixin'
import CwaAdminToggle from '../../../input/cwa-admin-toggle.vue'

export default {
  components: { CwaAdminToggle },
  mixins: [ComponentManagerTabMixin],
  data() {
    return {
      draggableToggled: false
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
