import Vue from 'vue'
import {
  Notification,
  RemoveNotificationEvent,
  TimestampedNotification
} from '../templates/components/cwa-api-notifications/types'
import { NOTIFICATION_EVENTS } from '../events'

export default Vue.extend({
  data() {
    return {
      notifications: [] as TimestampedNotification[]
    }
  },
  mounted() {
    this.$cwa.$eventBus.$on(NOTIFICATION_EVENTS.add, this.addNotification)
    this.$cwa.$eventBus.$on(NOTIFICATION_EVENTS.remove, this.removeNotification)
    this.$cwa.$eventBus.$on(NOTIFICATION_EVENTS.clear, this.clearNotifications)
  },
  beforeDestroy() {
    this.$cwa.$eventBus.$off(NOTIFICATION_EVENTS.add, this.addNotification)
    this.$cwa.$eventBus.$off(
      NOTIFICATION_EVENTS.remove,
      this.removeNotification
    )
    this.$cwa.$eventBus.$off(NOTIFICATION_EVENTS.clear, this.clearNotifications)
  },
  methods: {
    isSupportedCategory(category) {
      const listenCategories = this.listenCategories || []
      return (
        (!category && !listenCategories.length) ||
        listenCategories.includes(category)
      )
    },
    clearNotifications(category) {
      if (!this.isSupportedCategory(category)) {
        return
      }
      this.notifications = []
    },
    addNotification(notificationEvent: Notification): TimestampedNotification {
      if (!this.isSupportedCategory(notificationEvent.category)) {
        return
      }
      // remove old notification if code already exists
      this.notifications.forEach((notification: Notification, index) => {
        if (notification.code === notificationEvent.code) {
          this.notifications.splice(index, 1)
        }
      })

      const timestamp = new Date()
      const notification = {
        ...notificationEvent,
        timestamp,
        id: timestamp.getTime()
      }
      this.notifications.unshift(notification)
      this.showErrors = true
      return notification
    },
    removeNotification(event: RemoveNotificationEvent) {
      if (!this.isSupportedCategory(event.category)) {
        return
      }
      const index = this.notifications.findIndex(
        (obj: Notification) => obj.code === event.code
      )
      if (index === -1) {
        return
      }
      this.notifications.splice(index, 1)
    }
  }
})
