<template>
  <cwa-input-wrapper :id="id" :label="label" :has-error="hasError">
    <div>
      <textarea
        v-if="isTextarea"
        :id="id"
        :required="required"
        @input="updateValue($event.target.value)"
      >{{ value }}</textarea>
      <input
        v-else
        :type="type"
        :id="id"
        :value="value"
        :required="required"
        @input="updateValue($event.target.value)" />
    </div>
  </cwa-input-wrapper>
</template>

<script>
import CwaInputMixin from './CwaInputMixin'
export default {
  mixins: [CwaInputMixin],
  props: {
    isTextarea: {
      type: Boolean,
      default: false
    },
    type: {
      type: String,
      default: 'text'
    }
  }
}
</script>
