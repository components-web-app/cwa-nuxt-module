import Vue from 'vue'

export default Vue.extend({
  methods: {
    updateQueryParams(newKey: string, newValue: any) {
      const params = []
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
      for (const [key, value] of existingParams) {
        if (key === newKey) {
          // existingValue = value
          continue
        }
        addParam(key, value)
      }
      addParam(newKey, newValue)

      const queryString = params
        .map(({ key, value }) => {
          return `${key}=${encodeURIComponent(value)}`
        })
        .join('&')
      this.$router.push(`?${queryString}`)
    }
  }
})
