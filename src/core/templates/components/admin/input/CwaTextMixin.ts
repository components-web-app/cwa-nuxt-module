import CwaInputMixin from './CwaInputMixin'

export default {
  mixins: [CwaInputMixin],
  props: {
    isTextarea: {
      type: Boolean,
      default: false
    },
    type: {
      type: String,
      default: 'text'
    }
  }
}
