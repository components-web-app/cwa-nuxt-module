import Vue from 'vue'
import SelectMixin from '../../../../mixins/SelectMixin'
import CwaInputMixin from './CwaInputMixin'

export default Vue.extend({
  mixins: [SelectMixin, CwaInputMixin]
})
