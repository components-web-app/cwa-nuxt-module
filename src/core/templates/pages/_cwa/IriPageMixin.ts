import Vue from 'vue'
import IriModalView from '../../components/iri-modal-view.vue'
import CwaPageCommonMixin from './CwaPageCommonMixin'
import IriModalMixin from './IriModalMixin'

export default (postEndpoint: string) => {
  return Vue.extend({
    components: { IriModalView },
    mixins: [CwaPageCommonMixin, IriModalMixin],
    data() {
      return {
        iri: decodeURIComponent(this.$route.params.iri),
        component: {
          reference: this.$route.query.reference || ''
        },
        postEndpoint
      }
    }
  })
}
