import consola from 'consola'
import IriMixin from './IriMixin'

export default {
  mixins: [IriMixin],
  data() {
    return {
      showPublished: true,
      draftIri: null
    }
  },
  async mounted() {
    if (this.resource?._metadata?.published && this.$cwa.isUser) {
      // check for a draft version
      const component = await this.$cwa.fetcher.fetchComponent(this.iri)
      if (this.iri !== component['@id']) {
        this.draftIri = component['@id']
        this.showPublished = false
      }
    }
  },
  computed: {
    displayIri() {
      return this.showPublished ? this.iri : this.draftIri || this.iri
    },
    category() {
      return this.$cwa.$storage.getCategoryFromIri(this.displayIri)
    },
    resource() {
      const type = this.$cwa.$storage.getTypeFromIri(
        this.displayIri,
        this.category
      )
      if (!type) {
        consola.warn(
          `Could not resolve a resource type for iri ${this.displayIri} in the category ${this.category}`
        )
        return null
      }
      consola.debug(
        `Resolved resource type for iri ${this.displayIri} in the category ${this.category} to ${type}`
      )
      return this.$cwa.resources[type].byId[this.displayIri]
    }
  }
}
