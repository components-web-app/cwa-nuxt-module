<script lang="ts">
import Vue from 'vue'
import CwaPageCommonMixin from '../CwaPageCommonMixin'
import page from '../../../page'
import { ADMIN_BAR_EVENTS } from '../../../../events'
import { StoreCategories } from '@cwa/nuxt-module/core/storage'

export default Vue.extend({
  extends: page,
  pageIriParam: 'iri',
  mixins: [CwaPageCommonMixin],
  // define this as the common mixin will want to use the cwa default layout
  layout({ $cwa }) {
    return $cwa.resources.Layout?.byId[$cwa.layout].uiComponent
  },
  computed: {
    currentPageMetadata() {
      const pageDataIri = this.$route.params.iri
      const resourceType = this.$cwa.$storage.getTypeFromIri(
        pageDataIri,
        StoreCategories.PageData
      )
      if (!resourceType) {
        return null
      }
      return this.resources[resourceType].byId[pageDataIri]
    },
    currentPageTemplateIri() {
      return this.currentPageMetadata.page
    }
  },
  mounted() {
    this.$cwa.$eventBus.$emit(ADMIN_BAR_EVENTS.changeView, 'page')
    this.$cwa.setEditMode(true)
    // this.$cwa.initMercure(true)
  }
})
</script>
