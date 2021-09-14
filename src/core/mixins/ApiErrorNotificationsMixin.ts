import Vue from 'vue'
import {
  NotificationEvent,
  NotificationLevels,
  RemoveNotificationEvent
} from '../templates/components/cwa-api-notifications/types'
import { NOTIFICATION_EVENTS, STATUS_EVENTS, StatusEvent } from '../events'

interface ApiViolationNotifications {
  notification: NotificationEvent
  removeEvent: RemoveNotificationEvent
}

export const getInputErrorNotificationCode = (field) => {
  return 'input-error-' + field
}

export default Vue.extend({
  data() {
    return {
      removeErrorEvents: [],
      fieldNameMap: {}
    } as {
      removeErrorEvents: ApiViolationNotifications[]
      fieldNameMap: { [key: string]: string }
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
        const field =
          this.fieldNameMap?.[violation.propertyPath] || violation.propertyPath
        const notificationCode = getInputErrorNotificationCode(field)
        const notification: NotificationEvent = {
          code: notificationCode,
          title: field || 'Input Error',
          message: violation.message,
          level: NotificationLevels.ERROR,
          endpoint,
          field,
          category: notificationCategory
        }
        this.$cwa.$eventBus.$emit(STATUS_EVENTS.change, {
          field,
          category: notificationCategory,
          status: -1
        } as StatusEvent)

        response.push(this.addNotificationEvent(notification))
      }
      return response
    },
    addNotificationEvent(notification: NotificationEvent) {
      this.$cwa.$eventBus.$emit(NOTIFICATION_EVENTS.add, notification)

      const removeEvent: RemoveNotificationEvent = {
        code: notification.code,
        category: notification.category,
        field: notification.field,
        endpoint: notification.endpoint
      }
      this.removeErrorEvents.push(removeEvent)

      return { notification, removeEvent }
    }
  }
})
