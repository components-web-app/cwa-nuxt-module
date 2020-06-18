import ResourceMixin from "@cwa/nuxt-module/core/mixins/ResourceMixin.js"
import {StoreCategories} from "@cwa/nuxt-modulecore/storage";

const category = StoreCategories.Component

export default {
  mixins: [ResourceMixin(category)]
}
