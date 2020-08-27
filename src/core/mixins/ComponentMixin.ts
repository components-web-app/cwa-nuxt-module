import { StoreCategories } from '../storage'
import ResourceMixin from './ResourceMixin'
import ContextMenuMixin from './ContextMenuMixin'
import ApiRequestMixin from './ApiRequestMixin'

const category = StoreCategories.Component

export default {
  mixins: [ResourceMixin(category), ContextMenuMixin, ApiRequestMixin],
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
