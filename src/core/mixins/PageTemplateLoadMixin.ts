import Vue from 'vue'

export default Vue.extend({
  data() {
    return {
      pageTemplateOptions: []
    }
  },
  methods: {
    async loadPageTemplateOptions() {
      const { data } = await this.$axios.get('/_/pages?isTemplate=1')
      const pages = data['hydra:member']
      this.pageTemplateOptions = pages.map((page) => {
        return {
          value: page['@id'],
          label: page.reference
        }
      })
    }
  }
})
