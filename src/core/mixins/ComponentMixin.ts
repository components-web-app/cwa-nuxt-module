import consola from 'consola'
import { StoreCategories } from '../storage'
import ResourceMixin from './ResourceMixin'

const category = StoreCategories.Component

export default {
  mixins: [ResourceMixin],
  computed: {
    resource () {
      const type = this.$cwa.$storage.getTypeFromIri(this.iri, category)
      if (!type) {
        consola.warn(`Could not resolve a resource type for iri ${this.iri} in the category ${category}`)
        return null
      }
      consola.debug(`Resolved resource type for iri ${this.iri} in the category ${category} to ${type}`)
      return this.$cwa.resources[type].byId[this.iri]
    }
  }
}
