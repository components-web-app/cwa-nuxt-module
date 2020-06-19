import ResourceMixin from "@cwa/nuxt-module/core/mixins/ResourceMixin.js"

const mixin = {
  mixins: [ResourceMixin],
  computed: {
    resource() {
      return this.$cwa.resources.Page.byId[this.iri]
    },
    layout() {
      return this.$cwa.resources.Layout.byId[this.resource.layout]
    }
  },
  watch: {
    'layout.reference': {
      handler() { return this.$cwa.setLayout(this.layout.reference) },
      immediate: true
    }
  }
}

export default mixin
