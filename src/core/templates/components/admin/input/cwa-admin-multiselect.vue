<template>
  <component
    :is="wrapper || (wrapper === false ? 'div' : 'cwa-input-wrapper')"
    :id="id"
    :label="label"
    :has-error="hasError"
  >
    <cwa-multiselect
      v-model="currentValue"
      :options="options"
      :required="required"
      :expanded="expanded"
      @expanded="handleExpanded"
    />
  </component>
</template>

<script>
import CwaMultiselect from '../../utils/cwa-multiselect'
import CwaSelectMixin from './CwaSelectMixin'
export default {
  components: { CwaMultiselect },
  mixins: [CwaSelectMixin],
  props: {
    wrapper: {
      type: Function,
      required: false,
      default: null
    },
    expanded: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  methods: {
    handleExpanded(isExpanded) {
      this.$emit('expanded', isExpanded)
    }
  }
}
</script>
