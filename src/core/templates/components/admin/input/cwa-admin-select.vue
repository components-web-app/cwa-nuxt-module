<template>
  <cwa-input-wrapper :id="id" :label="label" :has-error="hasError">
    <div class="select">
      <select
        :id="id"
        v-model="currentValue"
        :required="required"
        @change="selectChanged"
      >
        <option :value="null" disabled :selected="value === null">
          Please select
        </option>
        <option
          v-for="(opVal, key) in options"
          :key="opVal"
          :value="opVal"
          :selected="value === opVal"
        >
          {{ isOptionsArray ? opVal : key }}
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
      type: [Object, Array],
      required: true
    }
  },
  data() {
    return {
      currentValue: this.value
    }
  },
  computed: {
    isOptionsArray() {
      return Array.isArray(this.options)
    }
  },
  watch: {
    value(newValue) {
      this.currentValue = newValue
    }
  },
  methods: {
    selectChanged() {
      this.updateValue(this.currentValue)
    }
  }
}
</script>
