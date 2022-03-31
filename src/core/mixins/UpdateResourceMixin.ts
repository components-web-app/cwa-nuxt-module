import Vue from 'vue'
import consola from 'consola'
import ApiError from '../../inc/api-error'
import UpdateResourceError from '../../inc/update-resource-error'
import ApiErrorNotificationsMixin from './ApiErrorNotificationsMixin'

export default Vue.extend({
  mixins: [ApiErrorNotificationsMixin],
  methods: {
    async updateResource(
      iri,
      field,
      value,
      category: string = null,
      refreshEndpoints: string[] = [],
      notificationCategory: string = null
    ) {
      this.clearAllViolationNotifications()
      // what is to say that the field validation is dependent on other field values... we can get validation errors for any field.
      // we add and clear notifications localised to where the mixin is used.
      // const notificationCode = 'input-error-' + field
      // this.clearViolationNotification(notificationCode, notificationCategory)
      try {
        return await this.$cwa.updateResource(
          iri,
          { [field]: value },
          category || null,
          refreshEndpoints
        )
      } catch (message) {
        throw this.handleUpdateError(message, notificationCategory, iri)
      }
    },
    handleUpdateError(message, notificationCategory, iri) {
      if (!(message instanceof ApiError)) {
        throw message
      }
      if (message.isCancel) {
        consola.debug('Request cancelled: ' + message.message)
        return
      }
      if (!notificationCategory) {
        throw message
      }

      const notifications = this.handleApiViolations(
        message.violations,
        iri,
        notificationCategory
      )

      // const notification: Notification = {
      //   code: notificationCode,
      //   title: 'Input Error',
      //   message: message.message,
      //   level: NotificationLevels.ERROR,
      //   endpoint: iri,
      //   field,
      //   category: notificationCategory
      // }
      // this.$cwa.$eventBus.$emit(NOTIFICATION_EVENTS.add, notification)
      // this.$cwa.$eventBus.$emit(STATUS_EVENTS.change, {
      //   field,
      //   category: notificationCategory,
      //   status: -1
      // } as StatusEvent)

      return new UpdateResourceError(
        'API error updating resource',
        message,
        notifications
      )
    },
    async publishNow(iri) {
      if (!this.moment) {
        consola.error('Cannot publish. Moment not loaded.')
        return
      }
      try {
        await this.updateResource(
          iri,
          'publishedAt',
          this.moment.utc().toISOString(),
          this.$cwa.$storage.getCategoryFromIri(iri),
          this.refreshEndpoints,
          'components-manager'
        )
        this.$emit('close')
      } catch (error) {
        if (!(error instanceof UpdateResourceError)) {
          throw error
        }
        consola.error(error)
      }
    }
  }
})
