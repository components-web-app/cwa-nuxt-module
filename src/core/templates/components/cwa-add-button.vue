<template>
  <a class="cwa-add-button is-pulsing" @click="$emit('click')">
    <img src="../../assets/images/icon-add.svg" alt="Plus icon" />
  </a>
</template>

<style lang="sass">
@keyframes shadow-pulse
  0%
    box-shadow: none
  50%
    box-shadow: 0 0 0 1px $cwa-background-dark, 0 0 0 3px $cwa-color-primary, 0 0 0 5px $cwa-background-dark, 0 0 5px 6px $cwa-color-primary
    transform: translate(-50%, -50%) scale(1)
  100%
    box-shadow: none

@keyframes plus-pulse
  50%
    transform: scale(.85)

.cwa-add-button
  position: relative
  padding: 1.2rem
  font-size: 0
  line-height: 0
  white-space: nowrap
  cursor: pointer
  display: block
  > img
    position: relative
    transform: translate3d(0,0,0)
  &.is-pulsing
    &:before
      position: absolute
      content: ''
      top: 50%
      left: 50%
      width: 100%
      height: 100%
      background: $cwa-color-primary
      border-radius: 50%
      animation: shadow-pulse 1.7s infinite
      animation-timing-function: cubic-bezier(.61,-0.39,.41,1.42)
      transform-origin: 50% 50%
      transform: translate(-50%, -50%) scale(1.15)
      backface-visibility: hidden
    > img
      animation: plus-pulse 1.7s infinite linear
      animation-delay: .85s
</style>
