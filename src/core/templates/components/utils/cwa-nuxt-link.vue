<template>
  <component :is="domTag" v-if="isExternal" v-bind="linkProps">
    <slot />
  </component>
  <nuxt-link v-else v-bind="linkProps">
    <slot />
  </nuxt-link>
</template>

<script>
export default {
  props: {
    to: {
      type: String,
      required: false,
      default: '#'
    },
    tag: {
      type: String,
      required: false,
      default: null
    },
    exact: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  computed: {
    component() {
      return this.isExternal
    },
    isExternal() {
      return this.to.match(/^(?:(?:http(?:s)?|ftp):)?\/\//)
    },
    linkProps() {
      if (this.isExternal) {
        return {
          is: this.domTag,
          href: this.to,
          target: '_blank',
          rel: 'noopener'
        }
      }
      return {
        tag: this.domTag,
        to: this.to,
        exact: this.exact
      }
    },
    domTag() {
      return this.tag || 'a'
    }
  }
}
</script>
