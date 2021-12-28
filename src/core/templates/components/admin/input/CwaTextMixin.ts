import Vue from 'vue'
import CwaInputMixin from './CwaInputMixin'

export default Vue.extend({
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
})
