<script lang="ts">
import CommonMixin from '../CommonMixin'
import page from '../../../page'
export default {
  extends: page,
  pageIriParam: 'iri',
  mixins: [CommonMixin],
  // define this as the common mixin will want to use the cwa default layout
  layout({ $cwa }) {
    return $cwa.resources.Layout.byId[$cwa.layout].uiComponent
  },
  mounted() {
    this.$cwa.$eventBus.$emit('cwa:admin-bar:change-view', 'page')
    this.$cwa.setEditMode(true)
  },
  computed: {
    currentPageMetadata() {
      return this.resources.Page?.byId[this.currentPageTemplateIri]
    },
    currentPageTemplateIri() {
      return decodeURIComponent(this.$route.params.iri)
    }
  }
}
</script>
