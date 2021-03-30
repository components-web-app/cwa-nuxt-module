<template>
  <div class="publishable-status-tab">
    <div class="row">
      <div class="column is-narrow">
        Publishable status tab {{ resource['@id'] }}
      </div>
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
// .publishable-status-tab
</style>
