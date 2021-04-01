import debounce from 'lodash.debounce'
import consola from 'consola'
import {
  Notification,
  NotificationLevels,
  RemoveNotificationEvent
} from '../templates/components/cwa-api-notifications/types'
import { NOTIFICATION_EVENTS, STATUS_EVENTS, StatusEvent } from '../events'
import ApiError from '../../inc/api-error'
import ResourceMixin from './ResourceMixin'
import ApiRequestMixin from './ApiRequestMixin'

export default {
  mixins: [ResourceMixin, ApiRequestMixin],
  props: {
    field: {
      required: true,
      type: String
    },
    notificationCategory: {
      required: false,
      default: null,
      type: String
    },
    refreshEndpoints: {
      required: false,
      default() {
        return []
      },
      type: Array
    }
  },
  data() {
    return {
      inputValue: null,
      debouncedFn: null,
      outdated: false,
      error: null,
      pendingDebounce: false
    }
  },
  watch: {
    outdated(isOutdated) {
      this.$cwa.$eventBus.$emit(STATUS_EVENTS.change, {
        field: this.field,
        category: this.notificationCategory,
        status: isOutdated ? 0 : 1
      } as StatusEvent)
    },
    inputValue() {
      this.error = null
      if (this.valuesSame(this.resourceValue, this.inputValue)) {
        return
      }
      this.outdated = true
      this.pendingDebounce = true
      if (this.debouncedFn) {
        this.debouncedFn.cancel()
        this.$cwa.cancelPendingPatchRequest(this.iri)
      }
      this.debouncedFn = debounce(this.update, 100)
      this.debouncedFn()
    },
    resourceValue(newValue) {
      if (!this.pendingDebounce && this.valuesSame(newValue, this.inputValue)) {
        this.inputValue = this.normalizeValue(this.resourceValue)
      }
    }
  },
  computed: {
    resourceValue() {
      return this.resource[this.field]
    }
  },
  mounted() {
    this.inputValue = this.normalizeValue(this.resourceValue)
  },
  methods: {
    valuesSame(value1, value2) {
      const getValueAsComparable = (value) => {
        return this.requiresNormalizing(value)
          ? JSON.stringify(value) || null
          : null
      }
      return getValueAsComparable(value1) === getValueAsComparable(value2)
    },
    requiresNormalizing(value) {
      const type = typeof value
      return (
        value !== null &&
        (type === 'string' || type === 'object' || Array.isArray(value))
      )
    },
    normalizeValue(value) {
      return this.requiresNormalizing(value)
        ? JSON.parse(JSON.stringify(value)) || null
        : value
    },
    async update() {
      this.pendingDebounce = false
      const notificationCode = 'input-error-' + this.field
      const removeEvent: RemoveNotificationEvent = {
        code: notificationCode,
        category: this.notificationCategory
      }
      this.$cwa.$eventBus.$emit(NOTIFICATION_EVENTS.remove, removeEvent)

      try {
        await this.$cwa.updateResource(
          this.iri,
          { [this.field]: this.inputValue },
          this.category || null,
          this.refreshEndpoints
        )
        this.outdated = false
      } catch (message) {
        if (!(message instanceof ApiError)) {
          throw message
        }
        if (message.isCancel) {
          consola.debug('Request cancelled: ' + message.message)
          return
        }
        this.error = message
        const notification: Notification = {
          code: notificationCode,
          title: 'Input Error',
          message: message.message,
          level: NotificationLevels.ERROR,
          endpoint: this.iri,
          field: this.field,
          category: this.notificationCategory
        }
        this.$cwa.$eventBus.$emit(NOTIFICATION_EVENTS.add, notification)
        this.$cwa.$eventBus.$emit(STATUS_EVENTS.change, {
          field: this.field,
          category: this.notificationCategory,
          status: -1
        } as StatusEvent)
      }
    }
  }
}
