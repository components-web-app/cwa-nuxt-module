import Vue from 'vue'
import CwaAdminBar from '../templates/components/admin/cwa-admin-bar.vue'
import ComponentCollection from '../templates/components/core/component-collection.vue'

const mixin = Vue.extend({
  components: { ComponentCollection, CwaAdminBar },
  head() {
    const classPostfix = this.$cwa.isEditMode
      ? this.$cwa.isLayoutEditing
        ? 'is-layout-editing'
        : 'is-page-editing'
      : ''
    return {
      htmlAttrs: {
        class: `cwa-html ${classPostfix}`
      }
    }
  },
  computed: {
    layout() {
      return this.$cwa.resources.Layout.byId[this.$cwa.layout]
    },
    componentCollectionProps() {
      return {
        locationResourceId: this.$cwa.layout,
        locationResourceReference: this.layout.reference, // this.resource.reference,
        locationResourceType: 'layouts'
      }
    }
  }
})

export default mixin
