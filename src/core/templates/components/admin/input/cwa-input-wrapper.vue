<template>
  <div :class="['cwa-input', { 'has-error': hasError }]">
    <label :for="id">{{ label }}</label>
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
      required: true
    },
    hasError: {
      type: Boolean,
      default: false
    }
  }
}
</script>
