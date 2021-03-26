<template>
  <div class="component-load-error">
    <div
      v-if="message"
      :class="['notice', { 'is-danger': isDanger }]"
      v-html="message"
    />
    <slot />
  </div>
</template>

<script>
export default {
  props: {
    message: {
      type: String,
      required: false,
      default: null
    },
    isDanger: {
      type: Boolean,
      default: false
    }
  }
}
</script>
