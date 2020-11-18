<template>
  <cwa-input-wrapper :id="id" :label="label" :has-error="hasError">
    <div class="select">
      <select
        :id="id"
        :required="required"
        @input="updateValue($event.target.value)">
        <option :value="null" disabled :selected="value === null">Please select</option>
        <option
          v-for="(opVal, key) in options"
          :key="isOptionsArray ? opVal : key"
          :value="isOptionsArray ? opVal : key"
          :selected="value === (isOptionsArray ? opVal : key)"
        >
          {{ opVal }}
        </option>
      </select>
    </div>
  </cwa-input-wrapper>
</template>

<script>
import CwaInputMixin from './CwaInputMixin'
export default {
  mixins: [CwaInputMixin],
  props: {
    options: {
      type: [Object,Array],
      required: true
    }
  },
  computed: {
    isOptionsArray()
    {
      return Array.isArray(this.options)
    }
  }
}
</script>
