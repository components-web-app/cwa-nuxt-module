<template>
  <component
    :is="wrapper || (wrapper === false ? 'div' : 'cwa-input-wrapper')"
    :id="id"
    :label="label"
    :has-error="hasError"
  >
    <flat-pickr
      :value="localValue"
      :config="config"
      placeholder="Select date"
      name="date"
      @input="updateValue"
    />
  </component>
</template>

<script>
import 'flatpickr/dist/flatpickr.css'
import FlatPickr from 'vue-flatpickr-component'
import ApiDateParserMixin from '../../../../mixins/ApiDateParserMixin'
import CwaTextMixin from './CwaTextMixin'

export default {
  components: { FlatPickr },
  mixins: [CwaTextMixin, ApiDateParserMixin],
  data() {
    return {
      config: {
        wrap: false,
        altFormat: 'M j, Y @ H:i',
        altInput: true,
        dateFormat: 'm-d-Y H:i:S',
        enableTime: true,
        time_24hr: true
      }
    }
  },
  computed: {
    localValue() {
      if (!this.value) {
        return null
      }
      return this.parseDateToLocal(this.value).format('MM-DD-YYYY HH:mm:SS')
    }
  },
  methods: {
    updateValue(dateValue) {
      const utcDate = this.parseLocalDateToUtc(dateValue).toISOString()
      this.$emit('input', utcDate)
    }
  }
}
</script>
