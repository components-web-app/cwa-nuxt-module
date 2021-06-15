import { API_EVENTS } from '../events'
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
    this.$cwa.$eventBus.$on(API_EVENTS.newDraft, this.newDraftListener)
    if (!this.resource?._metadata?.published) {
      this.draftIri = this.iri
      const publishedResource = this.resource.publishedResource
      if (
        publishedResource &&
        publishedResource?.['@id'] &&
        !this.$cwa.getResource(publishedResource['@id'])
      ) {
        this.$cwa.saveResource(publishedResource)
        this.publishedIri = publishedResource['@id'] || null
        this.$cwa.$storage.mapDraftResource({
          publishedIri: this.publishedIri,
          draftIri: this.draftIri
        })
      }
    } else {
      this.publishedIri = this.iri
      if (this.$cwa.user) {
        // check for a draft version
        const component = await this.$cwa.fetcher.fetchComponent(this.iri)
        // component returned this time may be a draft
        if (this.publishedIri !== component['@id']) {
          this.draftIri = component['@id']
        }
      }
    }
  },
  beforeDestroy() {
    this.$cwa.$eventBus.$off(API_EVENTS.newDraft, this.newDraftListener)
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
  },
  methods: {
    newDraftListener({ publishedIri, draftIri }) {
      if (this.publishedIri !== publishedIri) {
        return
      }
      this.draftIri = draftIri
    }
  }
}
