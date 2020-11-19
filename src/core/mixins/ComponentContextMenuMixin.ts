import IriMixin from './IriMixin'
import ContextMenuMixin from './AdminDialogMixin'

export default {
  mixins: [IriMixin, ContextMenuMixin],
  data () {
    return {
      defaultContextMenuData: {
        Delete: {
          callback: this.deleteSelf
        }
      }
    }
  },
  computed: {
    contextMenuCategory () {
      return `Component (${this.resource.uiComponent || this.resource['@type']})`
    }
  },
  methods: {
    deleteSelf () {
      this.$cwa.deleteResource(this.iri)
    }
  }
}
