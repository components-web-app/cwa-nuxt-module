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
      if (this.resourceValue === this.inputValue) {
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
      if (!this.pendingDebounce && newValue !== this.inputValue) {
        this.inputValue = newValue
      }
    }
  },
  computed: {
    resourceValue() {
      return this.resource[this.field]
    }
  },
  mounted() {
    const value = this.resourceValue
    const type = typeof value
    const requiresNormalizing =
      value !== null && (type === 'string' || type === 'object')
    // clone any value so we are not mutating the store
    this.inputValue = requiresNormalizing
      ? JSON.parse(JSON.stringify(value)) || null
      : value
  },
  methods: {
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
