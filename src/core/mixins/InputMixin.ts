import debounce from 'lodash.debounce'
import { NotificationEvents, Notification, NotificationLevels } from '../templates/components/cwa-api-notifications/types'
import ComponentMixin from './ComponentMixin'

export default {
  mixins: [ComponentMixin],
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
  data () {
    return {
      inputValue: null,
      debouncedFn: null,
      outdated: false,
      error: null
    }
  },
  watch: {
    inputValue () {
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
  mounted () {
    this.inputValue = this.resource[this.field]
  },
  methods: {
    async update () {
      try {
        await this.$cwa.updateResource(this.iri, { [this.field]: this.inputValue }, this.category || null)
        this.outdated = false
      } catch (message) {
        this.error = message
        const notification: Notification = {
          message,
          level: NotificationLevels.ERROR,
          endpoint: this.iri,
          field: this.field,
          category: this.notificationCategory
        }
        this.$root.$emit(NotificationEvents.add, notification)
      }
    }
  }
}
