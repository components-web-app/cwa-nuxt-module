<template>
  <cwa-admin-datepicker id="component" v-model="inputValue" v-bind="props" />
</template>
<script>
import Vue from 'vue'
import CwaAdminDatepicker from '../../input/cwa-admin-datepicker'
import InputMixin from '../../../../../mixins/ApiInputMixin'
import CwaInputMixin from '../../input/CwaInputMixin'

export default Vue.extend({
  components: { CwaAdminDatepicker },
  mixins: [InputMixin, CwaInputMixin],
  props: {
    notificationCategory: {
      required: false,
      default: 'components-manager',
      type: String
    }
  },
  data() {
    return {
      wrapperComponent: async () => await import('./wrapper.vue')
    }
  },
  computed: {
    props() {
      return Object.assign({}, this.$props, {
        id: `input-${this.resource?.['@id']}-${this.field}`,
        wrapper: this.wrapperComponent
      })
    }
  }
})
</script>
