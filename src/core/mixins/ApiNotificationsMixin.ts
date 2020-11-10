import Vue from 'vue'
import {
  Notification,
  NotificationEvents,
  RemoveNotificationEvent,
  TimestampedNotification
} from '../templates/components/cwa-api-notifications/types'

export default Vue.extend({
  data () {
    return {
      notifications: [] as TimestampedNotification[]
    }
  },
  mounted () {
    this.$cwa.$eventBus.$on(NotificationEvents.add, this.addNotification)
    this.$cwa.$eventBus.$on(NotificationEvents.remove, this.removeNotification)
  },
  beforeDestroy () {
    this.$root.$off(NotificationEvents.add, this.addNotification)
    this.$root.$off(NotificationEvents.remove, this.removeNotification)
  },
  methods: {
    isSupportedCategory (category) {
      const listenCategories = this.listenCategories || []
      return (!category && !listenCategories.length) || listenCategories.includes(category)
    },
    addNotification (notificationEvent: Notification): TimestampedNotification {
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
      this.expandNotifications = true
      return notification
    },
    removeNotification (event: RemoveNotificationEvent) {
      if (!this.isSupportedCategory(event.category)) {
        return
      }
      const index = this.notifications.findIndex((obj: Notification) => (obj.code === event.code))
      if (index === -1) {
        return
      }
      this.notifications.splice(index, 1)
    }
  }
})
