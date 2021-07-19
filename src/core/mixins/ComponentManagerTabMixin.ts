import Vue from 'vue'
import IriMixin from './IriMixin'

export default Vue.extend({
  mixins: [IriMixin],
  props: {
    context: {
      type: Object,
      required: false,
      default: null
    }
  },
  computed: {
    inputId() {
      return (name) => {
        return `${this.resource?.['@id'] || '__missing_id__'}-${name}`
      }
    },
    storeComponent: {
      get() {
        return this.resource
      },
      set(resource) {
        if (!this.resource?.['@id']) {
          return
        }
        this.$cwa.$storage.setResource({
          resource
        })
      }
    },
    componentManagerState() {
      const cmStates =
        this.$cwa.$storage.getState('CwaComponentManagerStates') || {}
      return cmStates?.[this.iri] || {}
    },
    cmValue() {
      return (name) => {
        return this.componentManagerState[name] || null
      }
    }
  }
})
