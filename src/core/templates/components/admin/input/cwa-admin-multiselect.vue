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
    }
  }
}
</script>
