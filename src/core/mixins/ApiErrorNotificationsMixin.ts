import Vue from 'vue'
import {
  Notification,
  NotificationLevels,
  RemoveNotificationEvent
} from '../templates/components/cwa-api-notifications/types'
import { NOTIFICATION_EVENTS, STATUS_EVENTS, StatusEvent } from '../events'

interface ApiViolationNotifications {
  notification: Notification
  removeEvent: RemoveNotificationEvent
}

export const getInputErrorNotificationCode = (field) => {
  return 'input-error-' + field
}

export default Vue.extend({
  data() {
    return {
      removeErrorEvents: []
    } as {
      removeErrorEvents: ApiViolationNotifications[]
    }
  },
  methods: {
    clearAllViolationNotifications() {
      for (const removeEvent of this.removeErrorEvents) {
        this.$cwa.$eventBus.$emit(NOTIFICATION_EVENTS.remove, removeEvent)
      }
      this.removeErrorEvents = []
    },
    handleApiViolations(
      violations,
      endpoint: string,
      notificationCategory: string
    ): ApiViolationNotifications[] {
      const response = []
      for (const violation of violations) {
        const field = violation.propertyPath
        const notificationCode = getInputErrorNotificationCode(field)
        const notification: Notification = {
          code: notificationCode,
          title: 'Input Error',
          message: violation.message,
          level: NotificationLevels.ERROR,
          endpoint,
          field,
          category: notificationCategory
        }
        this.$cwa.$eventBus.$emit(NOTIFICATION_EVENTS.add, notification)
        this.$cwa.$eventBus.$emit(STATUS_EVENTS.change, {
          field,
          category: notificationCategory,
          status: -1
        } as StatusEvent)

        const removeEvent: RemoveNotificationEvent = {
          code: notification.code,
          category: notification.category,
          field: notification.field
        }
        this.removeErrorEvents.push(removeEvent)

        response.push({ notification, removeEvent })
      }
      return response
    }
  }
})
