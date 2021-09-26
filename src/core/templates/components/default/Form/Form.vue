<template>
  <form-view class="cwa-form" :form-id="resource['@id']" />
</template>

<script lang="ts">
import Vue from 'vue'
import ComponentMixin from '@cwa/nuxt-module/core/mixins/ComponentMixin'
import { FormView as VuexFormView } from '@cwa/nuxt-module/core/vuex/FormsVuexModule'
import FormView from './FormView.vue'

export default Vue.extend({
  components: { FormView },
  mixins: [ComponentMixin],
  beforeDestroy() {
    const formView: VuexFormView = this.$cwa.forms.getView({
      formId: this.resource['@id'],
      path: []
    })
    if (formView.metadata.validation.success) {
      this.$cwa.forms.destroy({ component: this.resource })
    }
  },
  created() {
    this.$cwa.forms.init({ component: this.resource })
  }
})
</script>

<style lang="sass">
.cwa-form
  .is-validating
    border: 1px solid $cwa-warning !important
  .is-valid
    border: 1px solid $cwa-success !important
  .has-errors
    border: 1px solid $cwa-danger !important
</style>
