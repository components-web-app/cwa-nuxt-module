import ComponentCollection from '../templates/component-collection.vue'
import IriMixin from './IriMixin'

const mixin = {
  components: { ComponentCollection },
  mixins: [IriMixin],
  computed: {
    resource () {
      return this.$cwa.resources.Page?.byId[this.iri]
    },
    layout () {
      return this.$cwa.resources.Layout?.byId[this.resource.layout]
    },
    componentCollectionProps () {
      return {
        pageId: this.iri,
        pageReference: this.resource.reference
      }
    }
  },
  watch: {
    'layout.reference': {
      handler () { return this.$cwa.setLayout(this.layout?.uiComponent) },
      immediate: true
    }
  }
}

export default mixin
