import IriMixin from './IriMixin'

export default {
  mixins: [IriMixin],
  data() {
    return {
      showPublished: false,
      draftIri: null,
      publishedIri: null
    }
  },
  async mounted() {
    if (!this.resource?._metadata?.published) {
      this.draftIri = this.iri
      if (this.resource.publishedResource) {
        this.$cwa.saveResource(this.resource.publishedResource)
        this.publishedIri = this.resource.publishedResource?.['@id'] || null
        this.$cwa.$storage.mapDraftResource({
          publishedIri: this.publishedIri,
          draftIri: this.draftIri
        })
      }
    } else {
      this.publishedIri = this.iri
      if (this.$cwa.isUser) {
        // check for a draft version
        const component = await this.$cwa.fetcher.fetchComponent(this.iri)
        // component returned this time may be a draft
        if (this.publishedIri !== component['@id']) {
          this.draftIri = component['@id']
        }
      }
    }
  },
  computed: {
    isNew() {
      return this.displayIri.endsWith('/new')
    },
    displayIri() {
      return this.draftIri || this.publishedIri || this.iri
    },
    category() {
      return this.$cwa.$storage.getCategoryFromIri(this.displayIri)
    },
    resource() {
      return this.$cwa.getResource(this.displayIri)
    }
  }
}
