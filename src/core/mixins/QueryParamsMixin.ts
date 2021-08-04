import Vue, { PropType } from 'vue'

export default Vue.extend({
  props: {
    staticQueryParameters: {
      type: Array as PropType<{ key: string; value: string }[]>,
      required: false,
      default: null
    }
  },
  data() {
    return {
      previousQueryFields: []
    }
  },
  methods: {
    updateQueryParams(newKeys: any, newValue: any) {
      if (!Array.isArray(newKeys)) {
        newKeys = [newKeys]
      }
      let params = []
      const addParam = (key, value) => {
        if (Array.isArray(value)) {
          value.forEach((item) => {
            addParam(key, item)
          })
          return
        }
        params.push({
          key,
          value
        })
      }

      // let existingValue = null
      const existingParams = Object.entries(this.$route.query)
      const staticKeys = this.staticQueryParameters
        ? this.staticQueryParameters.map(({ key }) => key)
        : []
      for (const [key, value] of existingParams) {
        if (
          newKeys.includes(key) ||
          this.previousQueryFields.includes(key) ||
          staticKeys.includes(key)
        ) {
          // existingValue = value
          continue
        }
        addParam(key, value)
      }
      if (newValue !== null) {
        for (const newKey of newKeys) {
          addParam(newKey, newValue)
        }
      }

      this.previousQueryFields = newKeys

      if (this.staticQueryParameters) {
        params = [...this.staticQueryParameters, ...params]
      }
      const queryString = params
        .map(({ key, value }) => {
          return `${key}=${encodeURIComponent(value)}`
        })
        .join('&')
      this.$router.push(`?${queryString}`)
    }
  }
})
