import debounce from 'lodash.debounce'
import {
  Notification,
  NotificationLevels
} from '../templates/components/cwa-api-notifications/types'
import { NOTIFICATION_EVENTS, STATUS_EVENTS, StatusEvent } from '../events'
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
    }
  },
  data() {
    return {
      inputValue: null,
      debouncedFn: null,
      outdated: false,
      error: null
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
      if (this.resource[this.field] === this.inputValue) {
        return
      }
      this.outdated = true
      if (this.debouncedFn) {
        this.debouncedFn.cancel()
      }
      this.debouncedFn = debounce(this.update, 100)
      this.debouncedFn()
    }
  },
  mounted() {
    const value = this.resource[this.field]
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
      try {
        await this.$cwa.updateResource(
          this.iri,
          { [this.field]: this.inputValue },
          this.category || null
        )
        this.outdated = false
      } catch (message) {
        this.error = message
        const notification: Notification = {
          code: 'input-error',
          title: 'Input Error',
          message,
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
