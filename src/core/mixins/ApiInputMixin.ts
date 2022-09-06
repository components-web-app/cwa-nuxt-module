import Vue from 'vue'
import debounce from 'lodash.debounce'
import { STATUS_EVENTS, StatusEvent } from '../events'
import ResourceMixin from './ResourceMixin'
import ApiRequestMixin from './ApiRequestMixin'
import UpdateResourceMixin from './UpdateResourceMixin'

export default Vue.extend({
  mixins: [ResourceMixin, ApiRequestMixin, UpdateResourceMixin],
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
      pendingDebounce: false,
      updatingResourceValue: null
    }
  },
  computed: {
    resourceValue() {
      return this.resource?.[this.field]
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
    inputValue(newValue) {
      this.error = null
      const expectedResourceValue = this.updatingResourceValue
        ? this.updatingResourceValue
        : this.resourceValue
      if (this.valuesSame(expectedResourceValue, newValue)) {
        return
      }
      this.outdated = true
      this.pendingDebounce = true
      this.$cwa.increaseMercurePendingProcessCount(1)
      this.$cwa.cancelPendingPatchRequest(this.iri)
      if (this.debouncedFn) {
        this.debouncedFn.cancel()
        this.$cwa.decreaseMercurePendingProcessCount(1)
      }
      this.debouncedFn = debounce(async () => {
        this.debouncedFn = null
        try {
          await this.update()
        } finally {
          this.$cwa.decreaseMercurePendingProcessCount(1)
        }
      }, 200)
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
      if (value === undefined) {
        value = null
      }
      return this.requiresNormalizing(value)
        ? JSON.parse(JSON.stringify(value)) || null
        : value
    },
    async update() {
      this.pendingDebounce = false
      this.updatingResourceValue = this.inputValue
      const result = await this.updateResource(
        this.iri,
        this.field,
        this.inputValue,
        this.category,
        this.refreshEndpoints,
        this.notificationCategory
      )
      this.updatingResourceValue = null
      if (result !== false) {
        this.outdated = false
      }
    }
  }
})
