import Vue from 'vue'

export default Vue.extend({
  data() {
    return {
      layouts: [],
      layoutsLoading: false
    }
  },
  async mounted() {
    this.layoutsLoading = true
    const response = await this.$axios.$get('/_/layouts?order[reference]=asc')
    this.layouts = response['hydra:member'].reduce((obj, layout) => {
      obj[layout['@id']] = layout.reference
      return obj
    }, {})
    this.layoutsLoading = false
  }
})
