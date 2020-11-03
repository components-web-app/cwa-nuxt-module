import Vue from 'vue'
import { Notification, NotificationEvents, TimestampedNotification } from '../templates/components/cwa-api-notifications/types'

export default Vue.extend({
  data () {
    return {
      notifications: [] as TimestampedNotification[]
    }
  },
  mounted () {
    this.$root.$on(NotificationEvents.add, this.addNotification)
  },
  beforeDestroy () {
    this.$root.$off(NotificationEvents.add, this.addNotification)
  },
  methods: {
    addNotification (notificationEvent: Notification): TimestampedNotification {
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
    removeNotification (index) {
      this.notifications.splice(index, 1)
    }
  }
})
