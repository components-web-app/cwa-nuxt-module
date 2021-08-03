<template>
  <div @click.stop>
    <select v-model="selectedOption" @change="updateSelectedOption">
      <option>Please select...</option>
      <option
        v-for="op of options"
        :key="`select-option-${op.value}`"
        :value="op"
      >
        {{ op.label || op.value }}
      </option>
    </select>
  </div>
</template>

<script lang="ts">
import Vue, { PropType } from 'vue'
import QueryInputMixin from '@cwa/nuxt-module/core/mixins/QueryInputMixin'

interface SelectOption {
  value: string
  label?: string
  queryKey?: string
}

export default Vue.extend({
  mixins: [QueryInputMixin],
  props: {
    options: {
      type: Array as PropType<SelectOption[]>,
      required: true
    }
  },
  data() {
    return {
      selectedOption: null
    }
  },
  methods: {
    updateSelectedOption() {
      this.inputValue = this.selectedOption?.value || null
      this.updateQuery(0, this.getQueryFieldsFromOption(this.selectedOption))
    },
    getQueryFieldsFromOption(option: SelectOption) {
      if (!option.queryKey) {
        return this.queryFields
      }
      return this.queryFields.map((field) => `${field}[${option.queryKey}]`)
    }
  }
})
</script>
