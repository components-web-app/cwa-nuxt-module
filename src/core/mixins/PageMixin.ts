import ResourceMixin from './ResourceMixin'

const mixin = {
  mixins: [ResourceMixin],
  computed: {
    resource () {
      return this.$cwa.resources.Page.byId[this.iri]
    },
    layout () {
      return this.$cwa.resources.Layout.byId[this.resource.layout]
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
      handler () { return this.$cwa.setLayout(this.layout.reference) },
      immediate: true
    }
  }
}

export default mixin
