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
import InputMixin from '@cwa/nuxt-module/core/mixins/InputMixin'
import CwaAdminMultiselect from '@cwa/nuxt-module/core/templates/components/admin/input/cwa-admin-multiselect.vue'
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
