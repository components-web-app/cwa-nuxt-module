import debounce from 'lodash.debounce'
import { NotificationEvent, NotificationLevels } from '../templates/components/cwa-api-notifications/types'
import ComponentMixin from './ComponentMixin'

export default {
  mixins: [ComponentMixin],
  props: {
    field: {
      required: true,
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
      } catch (error) {
        this.error = error
        const notification: NotificationEvent = {
          message: error,
          level: NotificationLevels.ERROR
        }
        this.$root.$emit('cwa-notification', notification)
      }
    }
  }
}
