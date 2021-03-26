<template>
  <div v-if="!!isShowing" class="cwa-error-notifications">
    <a class="icon" href="#" @click.prevent.stop="toggleShowErrors">
      <div class="triangle" />
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
      return !!this.totalNotifications.length
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
  .errors-list
    position: absolute
    list-style: none
    background: $white
    z-index: 10
    top: 100%
    left: 0
    margin-top: 15px
    min-width: 250px
    max-width: 350px
    &::before
      content: ''
      position: absolute
      bottom: 100%
      left: .95em
      width: 0
      height: 0
      border-left: 10px solid transparent
      border-right: 10px solid transparent
      border-bottom: 10px solid #E6E6E6
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
  .icon
    position: relative
    width: .95em
    height: .95em
    margin: 0 1.8rem
    display: block
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
