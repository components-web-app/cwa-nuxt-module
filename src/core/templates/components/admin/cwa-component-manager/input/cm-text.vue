<template>
  <cwa-admin-text
    v-if="type !== 'number'"
    id="component"
    v-model="inputValue"
    v-bind="$props"
    :wrapper="wrapperComponent"
  />
  <cwa-admin-text
    v-else
    id="component"
    v-model.number="inputValue"
    v-bind="$props"
    :wrapper="wrapperComponent"
  />
</template>
<script>
import InputMixin from '../../../../../mixins/InputMixin'
import CwaTextMixin from '../../input/CwaTextMixin'
import CwaAdminText from '../../input/cwa-admin-text.vue'

export default {
  components: { CwaAdminText },
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
  }
}
</script>
