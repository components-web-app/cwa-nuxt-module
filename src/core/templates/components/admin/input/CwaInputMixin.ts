import {
  Notification,
  NotificationEvents,
  RemoveNotificationEvent
} from '../../cwa-api-notifications/types'

import CwaInputWrapper from './cwa-input-wrapper.vue'
export default {
  components: { CwaInputWrapper },
  props: {
    id: {
      type: String,
      required: true
    },
    label: {
      type: String,
      required: false,
      default: null
    },
    value: {
      type: [String, Boolean, Array],
      required: false,
      default: null
    },
    required: {
      type: Boolean,
      default: false,
      required: false
    },
    notifications: {
      type: Array,
      required: false,
      default: null,
      validator(notifications) {
        if (!(notifications !== null && Array.isArray(notifications))) {
          return false
        }
        // notifications.forEach((item: Notification) => {})
        return true
      }
    }
  },
  watch: {
    notifications(newNotifications, oldNotifications) {
      if (oldNotifications && oldNotifications.length) {
        oldNotifications.forEach((notification: Notification) => {
          const removeEvent: RemoveNotificationEvent = {
            code: notification.code,
            category: notification.category
          }
          this.$cwa.$eventBus.$emit(NotificationEvents.remove, removeEvent)
        })
      }
      if (newNotifications && newNotifications.length) {
        newNotifications.forEach((notification: Notification) => {
          notification.title = this.label
          this.$cwa.$eventBus.$emit(NotificationEvents.add, notification)
        })
      }
    }
  },
  computed: {
    hasError() {
      return this.notifications && this.notifications.length > 0
    }
  },
  methods: {
    updateValue(value) {
      this.$emit('input', value)
    }
  }
}
