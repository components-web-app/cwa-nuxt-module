<template>
  <div class="status-icon"></div>
</template>

<style lang="sass">
.status-icon
  width: 20px
  height: 20px
  border-radius: 50%
  background: $cwa-success
  background-clip: content-box
  border: 3px solid transparent
  box-shadow: 0 0 0 1px $cwa-success
  &.is-warning
    background: $cwa-warning
    box-shadow: 0 0 0 1px $cwa-warning
  &.is-error
    background: $cwa-danger
    box-shadow: 0 0 0 1px $cwa-danger
</style>
