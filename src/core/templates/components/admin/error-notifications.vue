<template>
  <div v-show="!!isShowing" :class="['cwa-error-notifications']">
    <a
      ref="warningTriangle"
      class="cwa-icon"
      href="#"
      @click.prevent.stop="toggleShowErrors"
    >
      <div class="cwa-warning-triangle" />
      <span class="total">{{ totalNotifications }}</span>
    </a>
    <div v-show="showErrors" ref="errorsList" class="errors-list">
      <div class="arrow" data-popper-arrow></div>
      <ul>
        <li
          v-for="(notification, index) of notifications"
          :key="`notification-${index}`"
        >
          <p class="error-title">
            {{ notification.title }}
          </p>
          <p class="error-description">
            {{ notification.message }}
          </p>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import { createPopper } from '@popperjs/core'
import ApiNotificationsMixin from '../../../mixins/ApiNotificationsMixin'

export default {
  mixins: [ApiNotificationsMixin],
  props: {
    listenCategories: {
      type: Array,
      default: null
    },
    showAbove: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      showErrors: false,
      popperInstance: null
    }
  },
  computed: {
    totalNotifications() {
      return this.notifications.length
    },
    isShowing() {
      return !!this.totalNotifications
    }
  },
  watch: {
    isShowing: {
      handler(newValue) {
        this.$emit('showing', newValue)
        if (!this.popperInstance) {
          return
        }

        if (newValue) {
          this.popperInstance.setOptions((options) => ({
            ...options,
            modifiers: [
              ...options.modifiers,
              { name: 'eventListeners', enabled: true }
            ]
          }))
          this.popperInstance.update()
        } else {
          this.popperInstance.setOptions((options) => ({
            ...options,
            modifiers: [
              ...options.modifiers,
              { name: 'eventListeners', enabled: false }
            ]
          }))
        }
      },
      immediate: true
    }
  },
  mounted() {
    this.popperInstance = createPopper(
      this.$refs.warningTriangle,
      this.$refs.errorsList,
      {
        placement: this.showAbove ? 'top' : 'bottom',
        modifiers: [
          {
            name: 'offset',
            options: {
              offset: [0, this.showAbove ? -17 : 17]
            }
          },
          {
            name: 'arrow',
            options: {
              padding: 5 // 5px from the edges of the popper
            }
          },
          {
            name: 'preventOverflow',
            options: {
              padding: 8
            }
          }
        ]
      }
    )
    document.addEventListener('click', this.hideErrors)
  },
  beforeDestroy() {
    document.removeEventListener('click', this.hideErrors)
  },
  methods: {
    toggleShowErrors() {
      this.showErrors = !this.showErrors
    },
    hideErrors() {
      this.showErrors = false
    }
  }
}
</script>

<style lang="sass">
.cwa-error-notifications
  position: relative
  .cwa-icon
    margin: 0
    width: .95em
    height: .95em
    .total
      position: absolute
      z-index: 2
      color: white
      top: 50%
      left: 50%
      transform: translate(-50%, -35%)
      font-size: .8em
      font-weight: $font-weight-bold
  .errors-list
    > .arrow
      position: absolute
      width: 20px
      height: 10px
      &::before
        content: ''
        position: absolute
        left: 0
        width: 0
        height: 0
    &[data-popper-placement^='top'] > .arrow
      bottom: -10px
      &::before
        border-top: 10px solid #E6E6E6
        border-left: 10px solid transparent
        border-right: 10px solid transparent
    &[data-popper-placement^='bottom'] > .arrow
      top: -10px
      &::before
        border-bottom: 10px solid #E6E6E6
        border-left: 10px solid transparent
        border-right: 10px solid transparent
    &[data-popper-placement^='left'] > .arrow
      right: -10px
      &::before
        border-left: 10px solid #E6E6E6
        border-top: 10px solid transparent
        border-bottom: 10px solid transparent
    &[data-popper-placement^='right'] > .arrow
      left: -10px
      &::before
        border-right: 10px solid #E6E6E6
        border-top: 10px solid transparent
        border-bottom: 10px solid transparent
    > ul
      list-style: none
      background: $white
      z-index: 10
      min-width: 250px
      max-width: 350px
      > li
        padding: 1rem
        background-color: #E6E6E6
        margin: 0
        p
          margin: 0
          &.error-title
            color: $cwa-color-primary
            font-size: 1.5rem
            font-weight: $font-weight-semi-bold
          &.error-description
            font-size: 1.3rem
            color: $cwa-navbar-background
        &:nth-child(2n)
          background-color: #F0F0F0
</style>
