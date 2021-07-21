import Vue from 'vue'
import {
  Notification,
  NotificationLevels
} from '../templates/components/cwa-api-notifications/types'
import { NOTIFICATION_EVENTS, STATUS_EVENTS, StatusEvent } from '../events'

export default Vue.extend({
  methods: {
    handleApiViolations(
      violations,
      endpoint: string,
      notificationCategory: string
    ): Notification[] {
      const notifications = []
      for (const violation of violations) {
        const field = violation.propertyPath
        const notificationCode = 'input-error-' + field
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
        notifications.push(notification)
      }
      return notifications
    }
  }
})
