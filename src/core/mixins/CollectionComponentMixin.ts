import Vue from 'vue'
import ComponentMixin from './ComponentMixin'

export default Vue.extend({
  mixins: [ComponentMixin],
  data() {
    return {
      fetching: false,
      loadedSubResources: false,
      collectionSubResourceKeys: []
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
      this.fetching = true
      this.loadedSubResources = false
      await this.$cwa.refreshResource(this.iri)
      this.$nextTick(async () => {
        await this.loadSubResources()
      })
      this.fetching = false
    },
    async loadSubResources() {
      this.loadedSubResources = false
      const subResourceIris = []
      for (const item of this.items) {
        let resource = this.$cwa.getResource(item['@id'])
        if (!resource) {
          this.$cwa.saveResource(item)
          resource = item
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
