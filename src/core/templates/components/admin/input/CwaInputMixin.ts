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
        if (!(notifications !== null && Array.isArray(notifications))) {
          return false
        }
        return true
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
        this.currentValue = newValue
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
          notification.title = this.label
          this.$cwa.$eventBus.$emit(NOTIFICATION_EVENTS.add, notification)
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
