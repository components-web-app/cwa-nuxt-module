<template>
  <div
    v-if="!!isShowing"
    :class="['cwa-error-notifications', { 'show-above': showAbove }]"
  >
    <a class="cwa-icon" href="#" @click.prevent.stop="toggleShowErrors">
      <div class="cwa-warning-triangle" />
      <span class="total">{{ totalNotifications }}</span>
    </a>
    <transition name="fade">
      <ul v-if="showErrors" class="errors-list" @click.stop>
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
    </transition>
  </div>
</template>

<script>
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
      showErrors: false
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
      },
      immediate: true
    }
  },
  mounted() {
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
  &.show-above
    .errors-list
      bottom: 100%
      margin-bottom: 17px
      &::before
        top: 100%
        border-top: 10px solid #E6E6E6
  &:not(.show-above)
    .errors-list
      top: 100%
      margin-top: 15px
      &::before
        bottom: 100%
        border-bottom: 10px solid #E6E6E6
  .errors-list
    position: absolute
    list-style: none
    background: $white
    z-index: 10
    left: 0
    min-width: 250px
    max-width: 350px
    &::before
      content: ''
      position: absolute
      left: .95em
      width: 0
      height: 0
      border-left: 10px solid transparent
      border-right: 10px solid transparent
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
  .cwa-icon
    margin: 0 1.8rem
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
</style>
