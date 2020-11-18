import CwaAdminBar from '../templates/components/cwa-admin-bar.vue'
import ComponentCollection from '../templates/component-collection.vue'

const mixin = {
  components: { ComponentCollection, CwaAdminBar },
  computed: {
    layout () {
      return this.$cwa.resources.Layout.byId[this.$cwa.layout]
    },
    componentCollectionProps () {
      return {
        locationResourceId: this.$cwa.layout,
        locationResourceReference: this.layout.reference, // this.resource.reference,
        isPage: false
      }
    }
  }
}

export default mixin
