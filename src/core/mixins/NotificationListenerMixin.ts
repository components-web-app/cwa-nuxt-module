import Vue from 'vue'
import { NOTIFICATION_EVENTS } from '../events'
import {
  NotificationEvent,
  RemoveNotificationEvent
} from '../templates/components/cwa-api-notifications/types'

export default Vue.extend({
  data() {
    return {
      listenFields: [],
      fieldNotifications: {}
    }
  },
  created() {
    this.$cwa.$eventBus.$on(
      NOTIFICATION_EVENTS.add,
      this.fieldAddNotificationHandler
    )
    this.$cwa.$eventBus.$on(
      NOTIFICATION_EVENTS.remove,
      this.fieldRemoveNotificationHandler
    )
  },
  beforeDestroy() {
    this.$cwa.$eventBus.$off(
      NOTIFICATION_EVENTS.add,
      this.fieldAddNotificationHandler
    )
    this.$cwa.$eventBus.$off(
      NOTIFICATION_EVENTS.remove,
      this.fieldRemoveNotificationHandler
    )
  },
  methods: {
    getFieldListenerIndex(field: string, iri: string) {
      for (const [listenIndex, obj] of this.listenFields.entries()) {
        if (field === obj.field && iri === obj.iri) {
          return listenIndex
        }
      }
      return null
    },
    addFieldNotificationListener(field: string, iri?: string) {
      this.listenFields.push({ field, iri })
      this.$set(this.fieldNotifications, field, [])
    },
    removeFieldNotificationListener(field: string, iri?: string) {
      const index = this.getFieldListenerIndex(field, iri)
      if (index !== null) {
        this.listenFields.splice(index, 1)
        this.$delete(this.fieldNotifications, field)
      }
    },
    fieldAddNotificationHandler(notification: NotificationEvent) {
      if (
        notification.field &&
        this.fieldNotifications[notification.field] &&
        this.getFieldListenerIndex(
          notification.field,
          notification.endpoint
        ) !== null
      ) {
        this.fieldNotifications[notification.field].push(notification)
      }
    },
    fieldRemoveNotificationHandler(
      removeNotification: RemoveNotificationEvent
    ) {
      if (
        !removeNotification.field ||
        !removeNotification.endpoint ||
        this.getFieldListenerIndex(
          removeNotification.field,
          removeNotification.endpoint
        ) === null
      ) {
        return
      }
      const currentNotifications: NotificationEvent[] =
        this.fieldNotifications[removeNotification.field]
      if (currentNotifications) {
        currentNotifications.forEach((notification, index) => {
          if (notification.code === removeNotification.code) {
            currentNotifications.splice(index, 1)
          }
        })
      }
    }
  }
})
