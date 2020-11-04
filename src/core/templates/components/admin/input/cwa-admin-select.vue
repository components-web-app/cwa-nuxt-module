<template>
  <cwa-input-wrapper :id="id" :label="label">
    <div class="select">
      <select
        :id="id"
        :value="value"
        :required="required"
        @input="updateValue($event.target.value)">
        <option :value="null" disabled>Please select</option>
        <option v-for="(key, value) in options" :key="key" :value="key">{{ isOptionsArray ? key : value }}</option>
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
