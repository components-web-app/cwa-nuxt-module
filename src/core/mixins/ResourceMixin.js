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
  },
  computed: {
    resource() {
      const type = this.$cwa.$storage.getTypeFromIri(this.iri)
      return this.$cwa.resources[type].byId[this.iri]
    }
  }
}
