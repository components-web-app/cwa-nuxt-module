<template>
  <div :class="['cwa-component-manager-input', { 'has-error': hasError }]">
    <label v-if="label" :for="id">{{ label }}</label>
    <slot />
  </div>
</template>

<script>
export default {
  props: {
    id: {
      type: String,
      required: false,
      default: null
    },
    label: {
      type: String,
      required: false,
      default: null
    },
    hasError: {
      type: Boolean,
      default: false
    }
  }
}
</script>

<style lang="sass">
.cwa-component-manager-input
  display: flex
  align-items: center
  label
    +cwa-input-label
    font-size: inherit
    margin-right: .5rem
    white-space: nowrap
  input,
  textarea
    +cwa-input
    margin: 0

.cwa-component-manager-input
  .select
    +cwa-select-holder
    select
      +cwa-input

.cwa-component-manager-input
  +vue-multiselect
</style>
