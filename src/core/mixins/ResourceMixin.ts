import Vue from 'vue'
import consola from 'consola'
import { API_EVENTS } from '../events'
import IriMixin from './IriMixin'

export default Vue.extend({
  mixins: [IriMixin],
  data() {
    return {
      showPublished: false,
      draftIri: null,
      publishedIri: null
    }
  },
  computed: {
    isNew() {
      return this.iri.endsWith('/new')
    },
    category() {
      return this.$cwa.$storage.getCategoryFromIri(this.iri)
    },
    resource() {
      return this.$cwa.getResource(this.iri)
    }
  },
  async mounted() {
    this.$cwa.$eventBus.$on(API_EVENTS.newDraft, this.newDraftListener)
    if (!this.resource) {
      consola.error(`Resource could not be found for iri ${this.iri}`)
      return
    }
    if (!this.resource?._metadata?.published) {
      this.draftIri = this.iri
      const publishedIri = this.resource.publishedResource
      if (publishedIri && !this.$cwa.getResource(publishedIri)) {
        await this.$cwa.fetcher.fetchComponent(`${publishedIri}?published=true`)
        this.publishedIri = publishedIri
        this.$cwa.$storage.mapDraftResource({
          publishedIri: this.publishedIri,
          draftIri: this.draftIri
        })
      }
    } else {
      this.publishedIri = this.iri
      if (this.$cwa.user) {
        const draftIri = this.resource?.draftResource
        if (draftIri && this.$cwa.getResource(draftIri)) {
          this.draftIri = draftIri
          return
        }
        // check for a draft version
        const component = await this.$cwa.fetcher.fetchComponent(this.iri)
        if (!component) {
          return
        }
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
  methods: {
    newDraftListener({ publishedIri, draftIri }) {
      if (this.publishedIri !== publishedIri) {
        return
      }
      this.draftIri = draftIri
    }
  }
})
