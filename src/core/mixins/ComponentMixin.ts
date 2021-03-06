import ResourceMixin from './ResourceMixin'
import AdminDialogMixin from './AdminDialogMixin'
import ApiRequestMixin from './ApiRequestMixin'

export default {
  mixins: [ResourceMixin, AdminDialogMixin, ApiRequestMixin],
  computed: {
    metadata () {
      return this.resource._metadata || {}
    },
    publishable () {
      return 'published' in this.metadata
    },
    published () {
      return this.publishable ? this.metadata.published : true
    }
  }
}
