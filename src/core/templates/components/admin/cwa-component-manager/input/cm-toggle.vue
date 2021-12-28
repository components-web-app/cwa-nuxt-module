<template>
  <cwa-admin-toggle
    id="component"
    v-model="inputValue"
    :label="label"
    :wrapper="wrapperComponent"
  />
</template>
<script lang="ts">
import Vue from 'vue'
import InputMixin from '../../../../../mixins/ApiInputMixin'
import CwaInputMixin from '../../input/CwaInputMixin'
import CwaAdminToggle from '../../input/cwa-admin-toggle.vue'

export default Vue.extend({
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
})
</script>
