import Vue from 'vue'

export default Vue.extend({
  methods: {
    updateQueryParams(newKeys: any, newValue: any) {
      if (!Array.isArray(newKeys)) {
        newKeys = [newKeys]
      }
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
        if (newKeys.includes(key)) {
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

      const queryString = params
        .map(({ key, value }) => {
          return `${key}=${encodeURIComponent(value)}`
        })
        .join('&')
      this.$router.push(`?${queryString}`)
    }
  }
})
