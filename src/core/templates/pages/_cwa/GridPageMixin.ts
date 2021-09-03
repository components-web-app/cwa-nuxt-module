import Vue from 'vue'
import CwaFooterLogo from '../../components/utils/cwa-footer-logo.vue'
import GridPage from '../../components/admin/grid-page.vue'
import CwaPageCommonMixin from './CwaPageCommonMixin'

export default (pageName, modalPageName) =>
  Vue.extend({
    components: { GridPage, CwaFooterLogo },
    mixins: [CwaPageCommonMixin],
    data() {
      return {
        data: []
      }
    },
    computed: {
      addRouteProps() {
        return (iri) => ({
          name: modalPageName,
          params: { iri },
          query: this.$route.query
        })
      }
    },
    methods: {
      updateData(newData) {
        this.data = newData
      },
      async reloadAndClose() {
        await this.$refs.gridPage.loadData(true)
        await this.closeModal()
      },
      async closeModal() {
        await this.$router.push({ name: pageName, query: this.$route.query })
      },
      showAddPage(iri = 'add') {
        this.$router.push(this.addRouteProps(iri))
      }
    }
  })
