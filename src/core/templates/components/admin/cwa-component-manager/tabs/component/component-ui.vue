<template>
  <div class="component-ui-tab">
    <div class="row">
      <div class="column is-narrow">Component tab {{ resource['@id'] }}</div>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    resource: {
      type: Object,
      required: true
    }
  }
}
</script>

<style lang="sass">
// .component-ui-tab
</style>
