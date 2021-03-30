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
    isNew() {
      return this.displayIri.endsWith('/new')
    },
    displayIri() {
      return this.showPublished ? this.iri : this.draftIri || this.iri
    },
    category() {
      return this.$cwa.$storage.getCategoryFromIri(this.displayIri)
    },
    resource() {
      return this.$cwa.$storage.getResource(this.displayIri)
    }
  }
}
