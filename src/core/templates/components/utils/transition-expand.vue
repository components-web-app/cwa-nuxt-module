<template>
  <transition
    name="expand"
    @enter="enter"
    @after-enter="afterEnter"
    @leave="leave"
    @after-leave="afterLeave"
  >
    <slot />
  </transition>
</template>

<script>
/**
 * @author Markus Oberlehner <Twitter: @MaOberlehner>
 * see: https://markus.oberlehner.net/blog/transition-to-height-auto-with-vue/
 * See: https://github.com/maoberlehner/transition-to-height-auto-with-vue/blob/master/src/components/TransitionExpand.vue
 */
export default {
  name: 'TransitionExpand',
  methods: {
    afterEnter(element) {
      // eslint-disable-next-line no-param-reassign
      element.style.height = 'auto'
      this.$emit('after-enter')
    },
    enter(element) {
      this.$emit('enter')
      const { width } = getComputedStyle(element)
      /* eslint-disable no-param-reassign */
      element.style.width = width
      element.style.position = 'absolute'
      element.style.visibility = 'hidden'
      element.style.height = 'auto'
      /* eslint-enable */
      const { height } = getComputedStyle(element)
      /* eslint-disable no-param-reassign */
      element.style.width = null
      element.style.position = null
      element.style.visibility = null
      element.style.height = 0
      /* eslint-enable */
      // Force repaint to make sure the
      // animation is triggered correctly.
      // eslint-disable-next-line no-unused-expressions
      getComputedStyle(element).height
      requestAnimationFrame(() => {
        // eslint-disable-next-line no-param-reassign
        element.style.height = height
      })
    },
    leave(element) {
      this.$emit('leave')
      const { height } = getComputedStyle(element)
      // eslint-disable-next-line no-param-reassign
      element.style.height = height
      // Force repaint to make sure the
      // animation is triggered correctly.
      // eslint-disable-next-line no-unused-expressions
      getComputedStyle(element).height
      requestAnimationFrame(() => {
        // eslint-disable-next-line no-param-reassign
        element.style.height = 0
      })
    },
    afterLeave() {
      this.$emit('after-leave')
    }
  }
}
</script>

<style scoped>
* {
  will-change: height;
  transform: translateZ(0);
  backface-visibility: hidden;
  perspective: 1000px;
}
</style>

<style>
.expand-enter-active,
.expand-leave-active {
  transition: height 0.25s ease-in-out;
  overflow: hidden;
}
.expand-enter,
.expand-leave-to {
  height: 0;
}
</style>
