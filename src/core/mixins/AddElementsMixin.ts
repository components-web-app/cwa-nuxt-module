import Vue from 'vue'
export default Vue.extend({
  data() {
    return {
      addedRelativePosition: false,
      elementsAdded: {}
    }
  },
  watch: {
    elementsAdded: {
      handler(elementAdded) {
        if (Object.values(elementAdded).length) {
          if (this.$el.style.position === '') {
            this.$el.style.position = 'relative'
            this.addedRelativePosition = true
          }
          return
        }
        if (this.addedRelativePosition) {
          this.$el.style.position = ''
          this.addedRelativePosition = false
        }
      },
      deep: false
    }
  }
})
