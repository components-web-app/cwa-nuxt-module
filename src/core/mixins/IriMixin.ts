<<<<<<< HEAD
export default {
=======
import Vue from 'vue'

export default Vue.extend({
>>>>>>> dev
  props: {
    iri: {
      type: String,
      required: true
    }
<<<<<<< HEAD
  }
}
=======
  },
  computed: {
    resource() {
      return this.$cwa.getResource(this.iri)
    }
  }
})
>>>>>>> dev
