import Vue from 'vue'

export default Vue.extend({
  computed: {
    componentMetadataObject() {
      return this.$cwa.$storage.state.componentMetadata
    },
    loadingComponents() {
      return this.componentMetadataObject.isLoading
    }
  },
  methods: {
    async fetchComponents() {
      return await this.$cwa.$storage.fetchComponentMetadata()
    }
  }
})
