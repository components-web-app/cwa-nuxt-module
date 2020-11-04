<script>
import CwaInputWrapper from './cwa-input-wrapper'
export default {
  components: {CwaInputWrapper},
  props: {
    id: {
      type: String,
      required: true
    },
    label: {
      type: String,
      required: true
    },
    value: {
      type: String,
      required: false
    },
    required: {
      type: Boolean,
      default: false,
      required: false
    }
  },
  methods: {
    updateValue: function (value) {
      this.$emit('input', value)
    }
  }
}
</script>
