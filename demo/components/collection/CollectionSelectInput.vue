<template>
  <div @click.stop>
    <select v-model="selectedOption" @change="updateSelectedOption">
      <option
        v-for="op of options"
        :key="`select-option-${op.value}-${op.queryKey}`"
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
    },
    defaultSelectedOptionIndex: {
      type: Number,
      default: 0
    }
  },
  data() {
    let selectedOptionIndex = null
    for (const [index, option] of this.options.entries()) {
      const optionQueryKey = this.getQueryFieldsFromOption(option)
      if (this.$route.query[optionQueryKey[0]] === `${option.value}`) {
        selectedOptionIndex = index
        break
      }
    }
    if (selectedOptionIndex === null) {
      selectedOptionIndex = this.defaultSelectedOptionIndex
    }
    return {
      selectedOption: this.options[selectedOptionIndex]
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
