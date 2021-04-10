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
    inputValue(newValue, oldValue) {
      this.error = null
      if (this.valuesSame(this.resourceValue, this.inputValue)) {
        return
      }
      this.outdated = true
      this.pendingDebounce = true
      this.$cwa.increaseMercurePendingProcessCount(1)
      if (this.debouncedFn) {
        this.debouncedFn.cancel()
        this.$cwa.cancelPendingPatchRequest(this.iri)
        this.$cwa.decreaseMercurePendingProcessCount(1)
      }
      this.debouncedFn = debounce(async () => {
        this.debouncedFn = null
        try {
          await this.update()
        } finally {
          this.$cwa.decreaseMercurePendingProcessCount(1)
        }
      }, 100)
      this.debouncedFn()
    },
    resourceValue: {
      immediate: true,
      handler(newValue) {
        if (!this.pendingDebounce) {
          this.inputValue = this.normalizeValue(newValue)
        }
      }
    }
  },
  computed: {
    resourceValue() {
      return this.resource[this.field]
    }
  },
  methods: {
    valuesSame(value1, value2) {
      return this.stringValue(value1) === this.stringValue(value2)
    },
    requiresNormalizing(value) {
      const type = typeof value
      return value !== null && (type === 'object' || Array.isArray(value))
    },
    stringValue(value) {
      return this.requiresNormalizing(value)
        ? JSON.stringify(value) || null
        : value
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
