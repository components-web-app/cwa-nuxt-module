<template>
  <button class="cm-button" @click="$emit('click')"><slot /></button>
</template>

<script>
export default {}
</script>

<style lang="sass">
.cm-button
  +cwa-control
  border: 1px solid $cwa-color-text-light
  font-weight: $font-weight-normal
  line-height: normal
  margin-bottom: 0
</style>
