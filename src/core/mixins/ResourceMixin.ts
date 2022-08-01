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

    // no resource found - fail
    if (!this.resource) {
      consola.error(`Resource could not be found for iri ${this.iri}`)
      return
    }

    // client side has auth so let's update the results
    // if it is not published, we should try and fetch the associated published resource
    if (!this.resource?._metadata?.published) {
      this.draftIri = this.iri
      // do we have the published already in store
      const mappedPublishedIri = this.$cwa.$storage.findPublishedIri(this.iri)
      if (mappedPublishedIri) {
        this.publishedIri = mappedPublishedIri
        return
      }

      // do we know the published IRI from the resource
      const publishedIri = this.resource.publishedResource
      if (publishedIri) {
        this.$cwa.$storage.mapDraftResource({
          publishedIri,
          draftIri: this.draftIri
        })

        if (this.$cwa.getResource(publishedIri)) {
          this.publishedIri = publishedIri
          return
        }
        await this.$cwa.fetcher.fetchResource(`${publishedIri}?published=true`)

        this.publishedIri = publishedIri
      }

      return
    }
    // it is published, we should try and populate the draft resource if we have credentials
    this.publishedIri = this.iri

    // do we have the published already in store
    const mappedDraftIri = this.$cwa.$storage.findDraftIri(this.iri)
    if (mappedDraftIri) {
      this.draftIri = mappedDraftIri
      return
    }

    if (this.$cwa.user) {
      // we may have been supplied with the draft IRI already
      const draftIri = this.resource?.draftResource
      // check for a draft version by fetching - API will respond draft if available
      const component = await this.$cwa.findResource(draftIri || this.iri)
      if (!component) {
        return
      }
      // component returned this time may be a draft, set the iri if it is
      if (this.publishedIri !== component['@id']) {
        this.draftIri = component['@id']
        this.$cwa.$storage.mapDraftResource({
          publishedIri: this.publishedIri,
          draftIri: this.draftIri
        })
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
