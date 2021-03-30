<template>
  <cwa-admin-toggle
    id="component"
    v-model="inputValue"
    :label="label"
    :wrapper="wrapperComponent"
  />
</template>
<script>
import InputMixin from '../../../../../mixins/InputMixin'
import CwaInputMixin from '../../input/CwaInputMixin'
import CwaAdminToggle from '../../input/cwa-admin-toggle.vue'

export default {
  components: { CwaAdminToggle },
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
  }
}
</script>
