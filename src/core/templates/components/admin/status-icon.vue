<template>
  <div :class="['status-icon', className]"></div>
</template>

<script>
export default {
  props: {
    status: {
      type: Number,
      required: true
    },
    category: {
      type: String,
      required: false,
      default: null
    }
  },
  computed: {
    className() {
      if (this.status === 1) {
        return 'is-success'
      }
      if (this.status === -1) {
        return 'is-error'
      }
      if (this.status === 0) {
        return 'is-warning'
      }
      return null
    }
  }
}
</script>

<style lang="sass">
.status-icon
  width: 20px
  height: 20px
  border-radius: 50%
  background-clip: content-box
  border: 3px solid transparent
  background-color: $cwa-color-text-light
  box-shadow: 0 0 0 1px $cwa-color-text-light
  &.is-success
    background-color: $cwa-success
    box-shadow: 0 0 0 1px $cwa-success
  &.is-warning
    background-color: $cwa-warning
    box-shadow: 0 0 0 1px $cwa-warning
  &.is-error
    background-color: $cwa-danger
    box-shadow: 0 0 0 1px $cwa-danger
</style>
