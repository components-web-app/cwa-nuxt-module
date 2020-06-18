import ComponentCollection from '@cwa/nuxt-module/core/templates/component-collection.vue'

export default {
  props: {
    resource: {
      type: Object,
      required: true
    }
  },
  components: {
    ComponentCollection
  },
  computed: {
    iri() {
      return this.resource['@id']
    }
  }
}
