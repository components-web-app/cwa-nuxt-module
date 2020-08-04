import debounce from 'lodash.debounce'
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
      outdated: false
    }
  },
  watch: {
    inputValue () {
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
      await this.$cwa.updateResource(this.iri, { [this.field]: this.inputValue }, this.category || null)
      this.outdated = false
    }
  }
}
