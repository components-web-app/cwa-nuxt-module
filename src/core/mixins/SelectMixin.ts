import Vue from 'vue'

export default Vue.extend({
  props: {
    options: {
      type: [Object, Array],
      required: true
    },
    // same as CwaInputMixin. for v-model usage
    value: {
      type: [String, Boolean, Array, Number],
      required: false,
      default: null
    }
  },
  computed: {
    isOptionsArray() {
      return Array.isArray(this.options)
    },
    hasNullOption() {
      return !!this.normalizedOptions.find(({ value }) => {
        return value === null
      })
    },
    normalizedOptions(): { value: any; label: string }[] {
      // objects passed will be key value pairs
      if (!this.isOptionsArray) {
        const ops = []
        for (const [value, label] of Object.entries(this.options)) {
          ops.push({
            value,
            label
          })
        }
        return ops
      }
      return this.normalizeValues(this.options)
    }
  },
  methods: {
    normalizeValues(options): { value: any; label: string }[] {
      // arrays passed will be strings or already normalized objects
      return options.map((op) => {
        if (typeof op === 'string' || op instanceof String) {
          return {
            value: op,
            label: op
          }
        }
        return op
      })
    }
  }
})
