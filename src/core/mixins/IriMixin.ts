import Vue from 'vue'

export default Vue.extend({
  props: {
    iri: {
      type: String,
      required: true
    }
  },
  computed: {
    resource() {
      return this.$cwa.getResource(this.iri)
    }
  }
})
