<template>
  <a :class="['cwa-add-button', 'is-pulsing', { 'is-pulsing': highlight }]" @click="$emit('click')">
    <img src="../../../assets/images/icon-add.svg" alt="Plus icon" />
  </a>
</template>

<script>
export default {
  props: {
    highlight: {
      type: Boolean,
      default: false,
      required: false
    }
  }
}
</script>

<style lang="sass">
@keyframes before-shadow-animation
  0%
    opacity: 0
    transform: scale(.8)
    box-shadow: none
  40%
    opacity: 1
  50%
    transform: scale(1.05)
    box-shadow: 0 0 2px 2px $cwa-color-primary
  65%
    opacity: 1
  100%
    opacity: 0
    transform: scale(1.1)
    box-shadow: 0 0 3px 1px $cwa-color-primary

@keyframes after-shadow-animation
  0%
    opacity: 0
    transform: scale(.8)
    box-shadow: none
  40%
    opacity: 1
  50%
    transform: scale(1.15)
    box-shadow: 0 0 4px 2px $cwa-color-primary
  65%
    opacity: 1
  100%
    opacity: 0
    transform: scale(1.4)
    box-shadow: 0 0 6px 2px $cwa-color-primary

@keyframes plus-pulse
  50%
    transform: scale(.8)

=radial-border
  position: absolute
  content: ''
  display: block
  margin: 0
  top: 0
  left: 0
  width: 100%
  height: 100%
  border-radius: 50%
  box-shadow: 0 0 0 2px $cwa-color-primary
  animation-timing-function: cubic-bezier(.61,-0.39,.41,1.42)
  backface-visibility: hidden
  opacity: 0
  transition: opacity .2s
  z-index: 3

.cwa-add-button
  position: relative
  padding: 1.4rem
  font-size: 0
  line-height: 0
  white-space: nowrap
  cursor: pointer
  display: block
  background: $cwa-color-primary
  border-radius: 50%
  z-index: 2
  > img
    position: relative
    transform: translate3d(0,0,0)
    user-select: none
    z-index: 2
  &::before,
  &::after
    +radial-border
  &.is-pulsing
    &:before,
    &:after
      opacity: 1
    &::before
      animation: before-shadow-animation 1.7s infinite linear
    &::after
      animation: after-shadow-animation 1.7s infinite linear
    > img
      animation: plus-pulse 1.7s infinite linear
      animation-delay: .85s
</style>
