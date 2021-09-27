import Vue from 'vue'
import ComponentMixin from '@cwa/nuxt-module/core/mixins/ComponentMixin'
import { FormView as VuexFormView } from '@cwa/nuxt-module/core/vuex/FormsVuexModule'
import FormView from '@cwa/nuxt-module/core/templates/components/default/Form/FormView.vue'

export default Vue.extend({
  components: { FormView },
  mixins: [ComponentMixin],
  data() {
    return {
      formType: 'App\\Form\\ExampleFormType'
    }
  },
  beforeDestroy() {
    if (this.isNew) {
      return
    }
    const formView: VuexFormView = this.$cwa.forms.getView({
      formId: this.resource['@id'],
      path: []
    })
    if (formView?.metadata.validation.success) {
      this.$cwa.forms.destroy({ component: this.resource })
    }
  },
  created() {
    if (this.isNew) {
      const initObj = {
        formType: this.formType
      }
      this.$emit('initial-data', initObj)
      return
    }
    this.$cwa.forms.init({ component: this.resource })
  }
})
