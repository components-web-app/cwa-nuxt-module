<template>
  <cwa-input-wrapper :id="id" :label="label" :has-error="hasError">
    <div>
      <textarea
        v-if="isTextarea"
        :id="id"
        v-model="value"
        :required="required"
        @input="updateValue($event.target.value)"
      />
      <input
        v-else
        :id="id"
        :type="type"
        :value="value"
        :required="required"
        @input="updateValue($event.target.value)"
      />
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
