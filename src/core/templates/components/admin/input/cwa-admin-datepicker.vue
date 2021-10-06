<template>
  <component
    :is="wrapper || (wrapper === false ? 'div' : 'cwa-input-wrapper')"
    :id="id"
    :label="label"
    :has-error="hasError"
  >
    <flat-pickr
      v-model="localValue"
      :config="config"
      placeholder="Select date"
      name="date"
    />
  </component>
</template>

<script>
import 'flatpickr/dist/flatpickr.css'
import FlatPickr from 'vue-flatpickr-component'
import ApiDateParserMixin from '../../../../mixins/ApiDateParserMixin'
import CwaInputMixin from './CwaInputMixin'

export default {
  components: { FlatPickr },
  mixins: [CwaInputMixin, ApiDateParserMixin],
  data() {
    return {
      config: {
        wrap: false,
        altFormat: 'M j, Y @ H:i',
        altInput: true,
        dateFormat: 'Z',
        enableTime: true,
        time_24hr: true
      }
    }
  },
  computed: {
    localValue: {
      get() {
        if (!this.currentValue) {
          return null
        }
        return this.parseDateToLocal(this.currentValue).format(
          'MM-DD-YYYY HH:mm:SS'
        )
      },
      set(newValue) {
        this.currentValue = this.parseLocalDateToUtc(newValue).toISOString()
      }
    }
  }
}
</script>
