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
      required: true
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
  label
    +cwa-input-label
    font-size: inherit
</style>
