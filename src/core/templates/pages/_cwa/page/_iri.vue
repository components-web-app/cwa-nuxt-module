<script lang="ts">
import Vue from 'vue'
import CwaPageCommonMixin from '../CwaPageCommonMixin'
import page from '../../../page'
import { ADMIN_BAR_EVENTS } from '../../../../events'

export default Vue.extend({
  extends: page,
  pageIriParam: 'iri',
  mixins: [CwaPageCommonMixin],
  // define this as the common mixin will want to use the cwa default layout
  layout({ $cwa }) {
    return $cwa.layoutUiComponent
  },
  computed: {
    currentPageMetadata() {
      return this.resources.Page?.byId[this.currentPageTemplateIri]
    },
    currentPageTemplateIri() {
      return decodeURIComponent(this.$route.params.iri)
    }
  },
  mounted() {
    this.$cwa.$eventBus.$emit(ADMIN_BAR_EVENTS.changeView, 'page')
    this.$cwa.setEditMode(true)
    this.$cwa.initMercure(true)
  }
})
</script>
