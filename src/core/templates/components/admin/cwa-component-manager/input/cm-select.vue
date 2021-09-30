<template>
  <cwa-admin-select
    id="component"
    v-model="inputValue"
    :label="label"
    :options="options"
    :wrapper="wrapperComponent"
  />
</template>
<script lang="ts">
import Vue from 'vue'
import InputMixin from '../../../../../mixins/ApiInputMixin'
import CwaSelectMixin from '../../input/CwaSelectMixin'
import CwaAdminSelect from '../../input/cwa-admin-select.vue'

export default Vue.extend({
  components: { CwaAdminSelect },
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
})
</script>
