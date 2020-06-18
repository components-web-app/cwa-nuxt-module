<template>
  <div class="notice" v-html="message" />
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
