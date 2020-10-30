<template>
  <div v-if="notifications.length">
    <div class="api-notifications">
      <p class="notification-title row">
        <span class="column">Notifications ({{ notifications.length }})</span>
        <span class="column is-narrow">
          <a class="show-hide-link" href="#" @click.prevent="expandNotifications = !expandNotifications">{{ expandNotifications ? 'hide' : 'show' }}</a>
        </span>
      </p>
      <div class="notifications-body" v-show="expandNotifications">
        <ul class="notification-list">
          <transition-group name="list" tag="li">
            <cwa-api-notification v-for="(notification, index) of notifications" :key="notification.id" :notification="notification" @remove="removeNotification(index)" />
          </transition-group>
        </ul>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {NotificationEvent, Notification} from "./types";
import CwaApiNotification from "./cwa-api-notification.vue";

export default {
  components: {CwaApiNotification},
  data() {
    return {
      notifications: [] as Notification[],
      expandNotifications: false as boolean
    }
  },
  mounted() {
    this.$root.$on('cwa-notification', this.addNotification)
  },
  beforeDestroy() {
    this.$root.$off('cwa-notification', this.addNotification)
  },
  methods: {
    addNotification(notificationEvent: NotificationEvent): Notification
    {
      const timestamp = new Date()
      const notification = {
        ...notificationEvent,
        timestamp,
        id: timestamp.getTime()
      }
      this.notifications.unshift(notification)
      this.expandNotifications = true
      return notification
    },
    removeNotification(index) {
      this.notifications.splice(index, 1)
    }
  }
}
</script>

<style lang="sass" scoped>
.api-notifications
  box-shadow: 1px 0 5px rgba($cwa-background-dark, .4)
  font-size: 1.5rem
  display: flex
  flex-direction: column
  height: 100%
  .notification-title
    padding: .75rem
    font-weight: $font-weight-bold
    background: $cwa-background-dark
    color: $white
    margin: 0
    width: 100%
    .show-hide-link
      color: $cwa-background-light
      font-size: .8em
      margin-left: 2rem
  .notifications-body
    padding: .75rem
    background: $white
  ul.notification-list
    flex: 1
    overflow: auto
    list-style: none
    margin: 0
    max-height: 33vh
    min-height: 150px
  .list-enter-active
    transition: all .4s

  .list-enter
    opacity: 0
    transform: translateY(-10px)

  .list-leave-active
    transition: none
  .list-leave-to
    opacity: 0
</style>
