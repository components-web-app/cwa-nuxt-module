import ComponentCollection from '../templates/component-collection.vue'
import IriMixin from './IriMixin'

const mixin = {
  components: { ComponentCollection },
  mixins: [IriMixin],
  mounted () {
    this.$cwa.$eventBus.$emit('cwa:admin-bar:change-view', 'page')
  },
  computed: {
    resource () {
      return this.$cwa.resources.Page?.byId[this.iri]
    },
    layout () {
      return this.$cwa.resources.Layout?.byId[this.resource.layout]
    },
    componentCollectionProps () {
      return {
        locationResourceId: this.iri,
        locationResourceReference: this.resource.reference,
        isPage: true
      }
    }
  }
}

export default mixin
