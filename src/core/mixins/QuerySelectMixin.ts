import Vue, { PropType } from 'vue'
import QueryInputMixin from './QueryInputMixin'

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
    return {
      selectedOption: null
    }
  },
  created() {
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
    this.selectedOption = this.options[selectedOptionIndex]
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
