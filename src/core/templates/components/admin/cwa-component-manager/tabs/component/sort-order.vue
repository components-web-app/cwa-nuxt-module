<template>
  <div class="sort-order-tab">
    <div class="row">
      <div class="column is-narrow">Sort order tab {{ resource['@id'] }}</div>
    </div>
  </div>
</template>

<script lang="ts">
import ComponentManagerTabMixin from '../../../../../../mixins/ComponentManagerTabMixin'

export default {
  mixins: [ComponentManagerTabMixin]
}
</script>

<style lang="sass">
// .sort-order-tab
</style>
