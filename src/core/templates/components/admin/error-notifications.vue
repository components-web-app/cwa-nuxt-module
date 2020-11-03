<template>
  <a class="cwa-error-notifications" href="#">
    <div class="triangle"></div>
    <span class="total">1</span>
  </a>
</template>

<style lang="sass">
.cwa-error-notifications
  position: relative
  width: .95em
  height: .95em
  margin: 0 1.8rem
  .total
    position: absolute
    z-index: 2
    color: white
    top: 50%
    left: 50%
    transform: translate(-50%, -35%)
    font-size: .8em
    font-weight: $font-weight-bold
  .triangle
    z-index: 1
    position: relative
    background-color: $cwa-danger
    transform: rotate(-60deg) skewX(-30deg) scale(1,.866)
    &:before,
    &:after
      content: ''
      position: absolute
      background-color: inherit
    &:before
      transform: rotate(-135deg) skewX(-45deg) scale(1.414,.707) translate(0,-50%)
    &:after
      transform: rotate(135deg) skewY(-45deg) scale(.707,1.414) translate(50%,0)
  .triangle,
  .triangle:before,
  .triangle:after
    width: 100%
    height: 100%
    border-top-right-radius: 30%
</style>
