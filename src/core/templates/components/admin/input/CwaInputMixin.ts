import Vue from 'vue'
import {
  Notification,
  RemoveNotificationEvent
} from '../../cwa-api-notifications/types'
import { NOTIFICATION_EVENTS } from '../../../../events'
import CwaInputWrapper from './cwa-input-wrapper.vue'

export default Vue.extend({
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
      type: [String, Boolean, Array, Number],
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
    },
    wrapper: {
      type: Function,
      required: false,
      default: null
    }
  },
  computed: {
    hasError() {
      return this.notifications && this.notifications.length > 0
    }
  },
  watch: {
    notifications(newNotifications, oldNotifications) {
      if (oldNotifications && oldNotifications.length) {
        oldNotifications.forEach((notification: Notification) => {
          const removeEvent: RemoveNotificationEvent = {
            code: notification.code,
            category: notification.category,
            field: notification.field
          }
          this.$cwa.$eventBus.$emit(NOTIFICATION_EVENTS.remove, removeEvent)
        })
      }
      if (newNotifications && newNotifications.length) {
        newNotifications.forEach((notification: Notification) => {
          notification.title = this.label
          this.$cwa.$eventBus.$emit(NOTIFICATION_EVENTS.add, notification)
        })
      }
    }
  },
  methods: {
    updateValue(value) {
      this.$emit('input', value)
    }
  }
})
