import Vue from 'vue'

export default Vue.extend({
  computed: {
    pageResource() {
      return this.$cwa.getResource(this.$cwa.loadedPage)
    },
    isDynamicPage() {
      return this.pageResource?.['@type'] !== 'Page'
    },
    isPageTemplate() {
      return !!this.pageResource?.isTemplate
    },
    pageDataProps() {
      return (
        this.pageResource._metadata?.page_data_metadata?.properties.reduce(
          (obj, item) => {
            obj[item.property] = item.componentShortName
            return obj
          },
          {}
        ) || {}
      )
    }
  },
  methods: {
    getPageDataPropComponent(pageDataProperty) {
      return this.pageDataProps?.[pageDataProperty] || null
    },
    getDynamicComponentIri(pageDataProperty) {
      return this.pageResource[pageDataProperty]
    }
  }
})
