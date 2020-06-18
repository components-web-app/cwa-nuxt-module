<template>
  <div class="notice">
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
    }
  }
}
</script>
