export default {
  props: {
    options: {
      type: [Object, Array],
      required: true
    }
  },
  data() {
    return {
      currentValue: this.value
    }
  },
  computed: {
    isOptionsArray() {
      return Array.isArray(this.options)
    },
    hasNullOption() {
      return !!this.normalizedOptions.find((op) => {
        return op.value === null
      })
    },
    normalizedOptions() {
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
  watch: {
    value(newValue) {
      this.currentValue = newValue
    }
  },
  methods: {
    normalizeValues(options) {
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
    },
    selectChanged() {
      this.$emit('input', this.currentValue)
    }
  }
}
