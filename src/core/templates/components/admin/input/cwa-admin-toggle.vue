<template>
  <label
    :for="id"
    :class="[
      'cwa-admin-toggle',
      { 'is-checked': !!currentValue, 'has-error': hasError }
    ]"
  >
    <span class="label">{{ label }}</span>
    <span class="switch">
      <input
        :id="id"
        v-model="currentValue"
        :required="required"
        type="checkbox"
      />
      <span class="slider" />
    </span>
  </label>
</template>

<script>
import CwaInputMixin from './CwaInputMixin'

export default {
  mixins: [CwaInputMixin],
  props: {
    value: {
      type: Boolean,
      required: true
    }
  }
}
</script>

<style lang="sass">
.cwa-admin-toggle
  display: flex
  align-items: center
  margin-bottom: 0
  opacity: .8
  transition: opacity .25s
  cursor: pointer
  user-select: none
  &.has-error
    .label
      color: $cwa-danger
    .switch
      input
        + .slider
          border-color: $cwa-danger
  &.is-checked
    opacity: 1
    color: $cwa-warning
  .label
    font-weight: $font-weight-light
    display: block
    padding-right: .5em
  .switch
    position: relative
    display: inline-block
    width: 2.5em
    height: 1.4em
    input
      opacity: 0
      width: 0
      height: 0

      + .slider
        position: absolute
        cursor: pointer
        top: 0
        left: 0
        right: 0
        bottom: 0
        border: 1px solid $cwa-color-text-light
        -webkit-transition: .4s
        transition: .4s
        border-radius: 34px

        &:before
          position: absolute
          content: ""
          height: calc(100% - 4px)
          width: calc(50% - 2px)
          left: 2px
          bottom: 2px
          background-color: $cwa-color-text-light
          -webkit-transition: .4s
          transition: .4s
          border-radius: 50%

      &:checked + .slider
        border-color: $cwa-warning
        &:before
          transform: translateX(calc(2.5em / 2 - 2px))
          background-color: $cwa-warning

      &:focus + .slider
        box-shadow: 0 0 1px #2196F3
</style>
