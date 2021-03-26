export default (reference) => ({
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
    updateElementHeight() {
      const newHeight = this.getCurrentElementHeight()
      if (newHeight === this.elementHeight) {
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
