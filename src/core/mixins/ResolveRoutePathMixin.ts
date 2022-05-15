import Vue from 'vue'

export default Vue.extend({
  methods: {
    resolveRoutePath(route) {
      if (!route) {
        return { name: '_cwa_page_data_iri', params: { iri: this.iri } }
      }
      if (route?.['@id']) {
        if (route.path) {
          return route.path
        }
        const resource = this.$cwa.getResource(route['@id'])
        if (resource) {
          return resource.path || '#'
        }
        return '#'
      }
      if (route.startsWith('/_/routes/')) {
        return route.replace(/^(\/_\/routes\/)/, '')
      }
      // eslint-disable-next-line no-console
      console.warn(`Unable to find the route path from the value '${route}'`)
      return '#'
    }
  }
})
