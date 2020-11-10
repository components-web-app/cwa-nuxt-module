<template>
  <cwa-input-wrapper :id="id" :label="label" :has-error="hasError">
    <div class="select">
      <select
        :id="id"
        :value="value"
        :required="required"
        @input="updateValue($event.target.value)">
        <option :value="null" disabled :selected="value === null">Please select</option>
        <option
          v-for="(value, key) in options"
          :key="isOptionsArray ? value : key"
          :value="isOptionsArray ? value : key">
          {{ value }}
        </option>
      </select>
    </div>
  </cwa-input-wrapper>
</template>

<script>
import CwaInputMixin from './cwa-input-mixin'
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
