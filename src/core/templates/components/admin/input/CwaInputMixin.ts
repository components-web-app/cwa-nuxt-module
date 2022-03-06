import Vue from 'vue'
import type { PropType } from 'vue'
import {
  NotificationEvent,
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
    errorLabel: {
      type: String,
      required: false,
      default: null
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
      type: Array as PropType<NotificationEvent[]>,
      required: false,
      default: null,
      validator(notifications) {
        return notifications !== null && Array.isArray(notifications)
      }
    },
    wrapper: {
      type: Function,
      required: false,
      default: null
    }
  },
  data() {
    return {
      currentValue: null
    }
  },
  computed: {
    hasError() {
      return this.notifications && this.notifications.length > 0
    }
  },
  watch: {
    value: {
      handler(newValue) {
        if (newValue !== this.currentValue) {
          this.currentValue = newValue
        }
      },
      immediate: true
    },
    currentValue() {
      this.updateValue()
    },
    notifications(newNotifications, oldNotifications) {
      if (oldNotifications && oldNotifications.length) {
        oldNotifications.forEach((notification: NotificationEvent) => {
          const removeEvent: RemoveNotificationEvent = {
            code: notification.code,
            category: notification.category,
            field: notification.field,
            endpoint: notification.endpoint
          }
          this.$cwa.$eventBus.$emit(NOTIFICATION_EVENTS.remove, removeEvent)
        })
      }
      if (newNotifications && newNotifications.length) {
        newNotifications.forEach((notification: NotificationEvent) => {
          notification.title = this.errorLabel || this.label
          // the notifications is being populated from tabs.vue which is an add notification listener
          // this.$cwa.$eventBus.$emit(NOTIFICATION_EVENTS.add, notification)
        })
      }
    }
  },
  methods: {
    updateValue() {
      this.$emit('input', this.currentValue)
    }
  }
})
