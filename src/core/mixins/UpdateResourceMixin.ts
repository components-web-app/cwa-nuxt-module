import consola from 'consola'
import {
  Notification,
  NotificationLevels,
  RemoveNotificationEvent
} from '../templates/components/cwa-api-notifications/types'
import { NOTIFICATION_EVENTS, STATUS_EVENTS, StatusEvent } from '../events'
import ApiError from '../../inc/api-error'
import UpdateResourceError from '../../inc/update-resource-error'

export default {
  methods: {
    async updateResource(
      iri,
      field,
      value,
      category: string = null,
      refreshEndpoints: string[] = [],
      notificationCategory: string = null
    ) {
      const notificationCode = 'input-error-' + field
      const removeEvent: RemoveNotificationEvent = {
        code: notificationCode,
        category: notificationCategory
      }
      this.$cwa.$eventBus.$emit(NOTIFICATION_EVENTS.remove, removeEvent)

      try {
        await this.$cwa.updateResource(
          iri,
          { [field]: value },
          category || null,
          refreshEndpoints
        )
      } catch (message) {
        if (!(message instanceof ApiError)) {
          throw message
        }
        if (message.isCancel) {
          consola.debug('Request cancelled: ' + message.message)
          return
        }
        if (notificationCategory) {
          const notification: Notification = {
            code: notificationCode,
            title: 'Input Error',
            message: message.message,
            level: NotificationLevels.ERROR,
            endpoint: iri,
            field,
            category: notificationCategory
          }
          this.$cwa.$eventBus.$emit(NOTIFICATION_EVENTS.add, notification)
          this.$cwa.$eventBus.$emit(STATUS_EVENTS.change, {
            field,
            category: notificationCategory,
            status: -1
          } as StatusEvent)
        }
        throw new UpdateResourceError(message)
      }
    }
  }
}
