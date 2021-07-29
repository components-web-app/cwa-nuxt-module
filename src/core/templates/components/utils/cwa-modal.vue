<template>
  <div class="cwa-modal is-active">
    <div class="modal-background" @click="close" />
    <div class="modal-content">
      <div class="modal-card">
        <div class="close-bar">
          <button class="modal-close" aria-label="close" @click="close">
            <close-icon class="close-icon" />
          </button>
        </div>
        <div class="modal-card-inner">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import CloseIcon from '../../../assets/images/icon-add.svg?inline'
export default {
  components: { CloseIcon },
  methods: {
    close() {
      this.$emit('close')
    }
  }
}
</script>

<style lang="sass">
$offset: 0
$modal-content-margin-mobile: 20px
$modal-content-spacing-mobile: 160px
$modal-content-spacing-tablet: 40px
$modal-breakpoint: $tablet
=overlay($offset: 0)
  bottom: $offset
  left: $offset
  position: absolute
  right: $offset
  top: $offset

.cwa-modal
  +overlay
  align-items: center
  display: none
  flex-direction: column
  justify-content: center
  overflow: hidden
  position: fixed
  z-index: 200
  padding: 0 4rem
  &.is-active
    display: flex
  .modal-background
    +overlay
    background-color: rgba($cwa-background-dark, .7)
  .modal-content
    margin: 0 $modal-content-margin-mobile
    max-height: calc(100vh - #{$modal-content-spacing-mobile})
    overflow: auto
    position: relative
    width: 100%
    display: flex
    justify-content: center
    box-shadow: 10px 12px 35px 8px rgba(black, .6)
    max-width: 800px
    background: $cwa-navbar-background
    +from($modal-breakpoint)
      margin: 0 auto
      max-height: calc(100vh - #{$modal-content-spacing-tablet})
    .modal-card
      width: 100%
      display: flex
      flex-wrap: wrap
      justify-content: center
      padding: 2rem 3rem 0 3rem
      .close-bar
        width: 100%
        display: flex
        justify-content: flex-end
      .modal-close
        position: relative
        background: none
        border: none
        height: 4rem
        width: 4rem
        padding: 0
        margin: 0
        overflow: hidden
        color: $white
        .close-icon
          position: absolute
          width: 100%
          height: 100%
          transform: rotate(45deg) scale(.6)
          transform-origin: 50% 50%
      .modal-card-inner
        width: 100%
        max-width: 600px
        margin-bottom: 5rem
        h2
          font-size: 2.8rem
          color: $white
</style>
