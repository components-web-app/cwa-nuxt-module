import Vue from 'vue'
import consola from 'consola'
// @ts-ignore
import components from '~/.nuxt/cwa/components'

export default Vue.extend({
  data() {
    return {
      loadingComponents: false
    }
  },
  methods: {
    async fetchComponents() {
      const loadedComponents = {}
      this.loadingComponents = true
      const data = await this.$cwa.getApiDocumentation()
      const properties = data.docs['hydra:supportedClass'].reduce(
        (obj, supportedClass) => {
          obj[supportedClass['rdfs:label']] = supportedClass[
            'hydra:supportedProperty'
          ].map((supportedProperty) => supportedProperty['hydra:title'])
          return obj
        },
        {}
      )
      for (const [key, endpoint] of Object.entries(
        data.entrypoint
      ) as string[][]) {
        if (endpoint.startsWith('/component/')) {
          const resourceName = key[0].toUpperCase() + key.slice(1)
          if (!this.getUiComponent(resourceName)) {
            continue
          }
          const isPublishable =
            properties?.[resourceName].includes('publishedAt') || false
          loadedComponents[resourceName] = {
            resourceName,
            endpoint,
            isPublishable
          }
        }
      }
      this.loadingComponents = false
      return loadedComponents
    },
    getUiComponent(resourceName) {
      const searchKey = `CwaComponents${resourceName}`
      const uiComponent = components[searchKey]
      if (!uiComponent) {
        consola.error(
          `UI component not found for API component named ${resourceName}. Searched for key ${searchKey}`
        )
        return
      }
      return components[searchKey]
    }
  }
})
