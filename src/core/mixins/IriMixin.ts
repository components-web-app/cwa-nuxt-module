export default {
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
}
