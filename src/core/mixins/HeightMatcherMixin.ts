import Vue from 'vue'

export default (reference) =>
  Vue.extend({
    data() {
      return {
        elementHeight: '0px',
        isAnimating: false,
        animateCheckInterval: null
      }
    },
    mounted() {
      this.animateCheckInterval = setInterval(this.checkAnimateStarted, 50)
    },
    beforeDestroy() {
      clearInterval(this.animateCheckInterval)
    },
    methods: {
      getCurrentElementHeight() {
        return this.$refs[reference]
          ? `${this.$refs[reference].getBoundingClientRect().height}px`
          : '0px'
      },
      updateElementHeight(retries: number = 0) {
        const newHeight = this.getCurrentElementHeight()
        if (newHeight === this.elementHeight) {
          if (retries < 10) {
            window.requestAnimationFrame(() => {
              this.updateElementHeight(++retries)
            })
            return
          }
          this.isAnimating = false
          return
        }
        this.elementHeight = newHeight
        window.requestAnimationFrame(this.updateElementHeight)
      },
      checkAnimateStarted() {
        if (
          this.elementHeight !== this.getCurrentElementHeight() &&
          !this.isAnimating
        ) {
          this.isAnimating = true
          this.updateElementHeight()
        }
      }
    }
  })
