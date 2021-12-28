<template>
  <div class="publishable-icon">
    <img
      v-if="isDraft"
      src="../../../../assets/images/icon-draft.svg"
      alt="Draft icon"
    />
    <img v-else src="../../../../assets/images/icon-live.png" alt="Live icon" />
  </div>
</template>

<script>
export default {
  props: {
    isDraft: {
      type: Boolean,
      required: true
    }
  }
}
</script>

<style lang="sass">
.publishable-icon
  img
    display: block
    width: 20px
</style>
