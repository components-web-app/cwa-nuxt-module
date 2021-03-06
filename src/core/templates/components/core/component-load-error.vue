<template>
  <div class="component-load-error">
    <div v-if="message" v-html="message" :class="['notice', { 'is-danger': isDanger }]"></div>
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
