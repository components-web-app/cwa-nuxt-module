import IriMixin from './IriMixin'

export default {
  props: {
    context: {
      type: Object,
      required: false,
      default: null
    }
  },
  mixins: [IriMixin],
  computed: {
    inputId() {
      return (name) => {
        return `${this.resource?.['@id'] || '__missing_id__'}-${name}`
      }
    },
    storeComponent: {
      get() {
        return this.resource['@id']
          ? this.$cwa.getResource(this.resource['@id'])
          : null
      },
      set(resource) {
        if (!this.resource['@id']) {
          return
        }
        this.$cwa.$storage.setResource({
          resource
        })
      }
    }
  }
}
