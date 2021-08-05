import Vue from 'vue'
import consola from 'consola'
import ApiError from '../../inc/api-error'
import ComponentMixin from './ComponentMixin'

export default Vue.extend({
  mixins: [ComponentMixin],
  data() {
    return {
      fetching: false,
      loadedSubResources: false,
      collectionSubResourceKeys: [],
      refreshCancelTokenSource: null
    }
  },
  computed: {
    items() {
      return this.resource?.collection?.['hydra:member'] || []
    }
  },
  watch: {
    '$route.query': {
      async handler() {
        await this.refreshCollection()
      },
      deep: true
    }
  },
  created() {
    this.loadSubResources()
  },
  methods: {
    async refreshCollection() {
      if (this.refreshCancelTokenSource) {
        this.refreshCancelTokenSource.cancel()
      }
      this.refreshCancelTokenSource = this.$axios.CancelToken.source()

      this.fetching = true
      this.loadedSubResources = false

      try {
        // this will submit with updated query parameters
        await this.$cwa.refreshResource(
          this.iri,
          null,
          this.refreshCancelTokenSource
        )
        this.fetching = false
        this.$nextTick(async () => {
          await this.loadSubResources()
        })
      } catch (error) {
        if (error instanceof ApiError && error.isCancel) {
          return
        }
        throw error
      }
    },
    async loadSubResources() {
      this.loadedSubResources = false
      const subResourceIris = []
      for (const item of this.items) {
        const resource = this.$cwa.getResource(item['@id'])
        if (!resource) {
          consola.error('Did not find saved collection item...' + item['@id'])
          continue
        }
        for (const subResourceIri of this.collectionSubResourceKeys) {
          resource?.[subResourceIri] &&
            subResourceIris.push(resource[subResourceIri])
        }
      }
      if (!subResourceIris.length) {
        this.loadedSubResources = true
      } else {
        await this.$cwa.refreshResources(subResourceIris).then(() => {
          this.loadedSubResources = true
        })
      }
    }
  }
})
