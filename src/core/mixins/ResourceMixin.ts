import consola from 'consola'
import IriMixin from './IriMixin'

export default function (category) {
  return {
    mixins: [IriMixin],
    data () {
      return {
        category
      }
    },
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
}
