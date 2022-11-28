<template>
  <component
    :is="domTag"
    v-if="isExternal"
    v-bind="linkProps"
    @click="handleExternalLinkClick"
  >
    <slot />
  </component>
  <nuxt-link v-else v-bind="linkProps">
    <slot />
  </nuxt-link>
</template>

<script>
import CloneComponentMixin from '../../../mixins/CloneComponentMixin'

export default {
  mixins: [CloneComponentMixin],
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
    },
    alwaysClickable: {
      type: Boolean,
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
      const href = this.to
      const className = this.allowNavigation ? null : 'cwa-disabled'
      if (this.isExternal) {
        return {
          is: this.domTag,
          href,
          target: '_blank',
          rel: 'noopener',
          class: className
        }
      }
      return {
        tag: this.domTag,
        to: href,
        exact: this.exact,
        class: className
      }
    },
    domTag() {
      return this.tag || 'a'
    },
    allowNavigation() {
      return (
        this.alwaysClickable || this.cloneAllowNavigate || !this.$cwa.isEditMode
      )
    }
  },
  methods: {
    handleExternalLinkClick(e) {
      if (!this.allowNavigation) {
        e.preventDefault()
      }
    }
  }
}
</script>

<style lang="sass">
//.cwa-disabled
//  +no-select
//  pointer-events: none
</style>
