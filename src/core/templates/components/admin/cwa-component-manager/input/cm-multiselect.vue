<template>
  <cwa-admin-multiselect
    id="component"
    v-model="inputValue"
    :label="label"
    :options="options"
    :wrapper="wrapperComponent"
  />
</template>
<script>
import CwaAdminMultiselect from '../../input/cwa-admin-multiselect.vue'
import InputMixin from '../../../../../mixins/ApiInputMixin'
import CwaSelectMixin from '../../input/CwaSelectMixin'

export default {
  components: { CwaAdminMultiselect },
  mixins: [InputMixin, CwaSelectMixin],
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
  }
}
</script>
