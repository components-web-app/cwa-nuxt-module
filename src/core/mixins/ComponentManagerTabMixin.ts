import Vue from 'vue'
import IriMixin from './IriMixin'
import ComponentManagerValueMixin from './ComponentManagerValueMixin'

export default Vue.extend({
  mixins: [IriMixin, ComponentManagerValueMixin],
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
    }
  }
})
