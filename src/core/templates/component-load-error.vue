<template>
  <div :class="['notice', { 'is-danger': isDanger }]">
    <div v-html="message"></div>
    <slot />
  </div>
</template>

<script>
export default {
  props: {
    message: {
      type: String,
      required: true
    },
    isDanger: {
      type: Boolean,
      default: false
    }
  }
}
</script>
