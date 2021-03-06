import ResourceMixin from './ResourceMixin'
import ContextMenuMixin from './ContextMenuMixin'
import ApiRequestMixin from './ApiRequestMixin'

export default {
  mixins: [ResourceMixin, ContextMenuMixin, ApiRequestMixin],
  computed: {
    metadata () {
      return this.resource._metadata || {}
    },
    publishable () {
      return 'published' in this.metadata
    },
    published () {
      return this.publishable ? this.metadata.published : true
    },
    defaultContextMenuData () {
      return {
        'Delete component': {
          callback: this.delete
        }
      }
    }
  },
  methods: {
    async delete () {
      try {
        await this.$cwa.deleteResource(this.iri)
        this.$emit('deleted')
      } catch (error) {
        this.handleApiError(error)
      }
    }
  }
}
