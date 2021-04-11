<template>
  <cwa-admin-datepicker id="component" v-model="inputValue" v-bind="props" />
</template>
<script>
import CwaAdminDatepicker from '../../input/cwa-admin-datepicker'
import InputMixin from '../../../../../mixins/InputMixin'
import CwaTextMixin from '../../input/CwaTextMixin'

export default {
  components: { CwaAdminDatepicker },
  mixins: [InputMixin, CwaTextMixin],
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
}
</script>
