import Vue from 'vue'
import ComponentGroup from '../templates/components/core/component-group.vue'
import { ADMIN_BAR_EVENTS } from '../events'
import IriMixin from './IriMixin'

const mixin = Vue.extend({
  components: { ComponentGroup },
  mixins: [IriMixin],
  computed: {
    resource() {
      return this.$cwa.resources.Page?.byId[this.iri]
    },
    layout() {
      return this.$cwa.resources.Layout?.byId[this.resource.layout]
    },
    componentGroupProps() {
      return {
        locationResourceId: this.iri,
        locationResourceReference: this.resource.reference,
        locationResourceType: 'pages'
      }
    }
  },
  mounted() {
    this.$cwa.$eventBus.$emit(ADMIN_BAR_EVENTS.changeView, 'page')
  }
})

export default mixin
