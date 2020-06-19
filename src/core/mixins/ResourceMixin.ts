import ComponentCollection from '@cwa/nuxt-module/core/templates/component-collection.vue'

export default {
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
