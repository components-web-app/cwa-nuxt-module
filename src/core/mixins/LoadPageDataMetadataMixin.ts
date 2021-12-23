import Vue from 'vue'

const mixin = Vue.extend({
  data() {
    return {
      loadingProperties: false,
      pageMetadatas: null
    }
  },
  computed: {
    pageDataPropertyOptions() {
      if (!this.pageMetadatas) {
        return []
      }
      const ops = [
        {
          value: null,
          label: 'None'
        }
      ]
      for (const pageData of this.pageMetadatas['hydra:member']) {
        for (const propertyMetadata of pageData.properties) {
          ops.push({
            value: propertyMetadata.property,
            label: propertyMetadata.property
          })
        }
      }
      return ops
    }
  },
  methods: {
    async loadPageDataMetadata() {
      this.loadingProperties = true
      this.pageMetadatas = await this.$axios.$get('/_/page_data_metadatas')
      this.loadingProperties = false
    }
  }
})

export default mixin
