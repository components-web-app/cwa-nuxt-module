<template>
  <div :class="['cwa-input', { 'has-error': hasError }]">
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
