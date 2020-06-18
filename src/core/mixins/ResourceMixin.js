import consola from 'consola'
import ComponentCollection from '@cwa/nuxt-module/core/templates/component-collection.vue'

export default (category) => ({
  props: {
    iri: {
      type: String,
      required: true
    }
  },
  components: {
    ComponentCollection
  },
  computed: {
    resource() {
      const type = this.$cwa.$storage.getTypeFromIri(this.iri, category)
      if (!type) {
        consola.warn(`Could not resolve a resource type for iri ${this.iri}`)
        return null
      }
      return this.$cwa.resources[type].byId[this.iri]
    }
  }
})
