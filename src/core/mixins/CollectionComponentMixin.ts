import Vue from 'vue'
import ComponentMixin from './ComponentMixin'

export default Vue.extend({
  mixins: [ComponentMixin],
  data() {
    return {
      loadedSubResources: false,
      collectionSubResourceKeys: []
    }
  },
  computed: {
    items() {
      return this.resource?.collection?.['hydra:member'] || []
    }
  },
  created() {
    const subResourceIris = []
    for (const item of this.items) {
      let resource = this.$cwa.getResource(item['@id'])
      if (!resource) {
        resource = this.$cwa.saveResource(item)
      }
      for (const subResourceIri of this.collectionSubResourceKeys) {
        resource?.[subResourceIri] &&
          subResourceIris.push(resource[subResourceIri])
      }
    }
    if (!subResourceIris.length) {
      this.loadedSubResources = true
    } else {
      this.$cwa.refreshResources(subResourceIris).then(() => {
        this.loadedSubResources = true
      })
    }
  }
})
