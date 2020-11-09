export default {
  methods: {
    getFilteredQuery (staticParams: string[], queryPrefixes: string[]) {
      return Object.keys(this.$route.query)
        .filter((key) => {
          if (staticParams.includes(key)) {
            return true
          }
          for (const prefix of queryPrefixes) {
            if (key.match(new RegExp(`^${prefix}\\[([a-zA-Z0-9]+)\]$`, 'i'))) {
              return true
            }
          }
          return false
        })
        .reduce((obj, key) => {
          obj[key] = this.$route.query[key]
          return obj
        }, {})
    }
  }
}
