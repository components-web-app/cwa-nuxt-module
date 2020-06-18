import ResourceMixin from "@cwa/nuxt-module/core/mixins/ResourceMixin.js"
import {StoreCategories} from "@cwa/nuxt-modulecore/storage";

const category = StoreCategories.PageData

export default {
  mixins: [ResourceMixin(category)]
}
