import Vue from 'vue'

export default Vue.extend({
  props: {
    notificationCategories: {
      type: Array,
      required: true
    },
    isSaved: {
      type: Boolean,
      required: true
    },
    isNew: {
      type: Boolean,
      required: true
    },
    showLoader: {
      type: Boolean,
      required: true
    }
  },
  data() {
    return {
      component: {}
    }
  }
})
