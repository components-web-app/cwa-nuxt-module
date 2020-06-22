import ComponentCollection from '@cwa/nuxt-module/core/templates/component-collection.vue'
import ContextMenuMixin from "./ContextMenuMixin";

export default {
  mixins: [ContextMenuMixin],
  props: {
    iri: {
      type: String,
      required: true
    }
  },
  components: {
    ComponentCollection
  }
}
