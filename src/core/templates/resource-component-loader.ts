import Vue from 'vue'
import ErrorComponent from '@cwa/nuxt-module/core/templates/components/core/component-load-error.vue'

export default Vue.extend({
  functional: true,
  props: {
    component: {
      required: true,
      type: String
    },
    message: {
      required: false,
      type: String,
      default: null
    },
    iri: {
      required: true,
      type: String
    },
    sortValue: {
      required: false,
      type: Number,
      default: null
    },
    showSort: {
      required: false,
      type: Boolean,
      default: false
    },
    highlightIsPosition: {
      type: Boolean,
      default: true
    },
    isDynamic: {
      type: Boolean,
      default: false
    }
  },
  render: (createElement, { props, parent }) => {
    const Comp =
      (parent.$options.components &&
        parent.$options.components[props.component]) ||
      Vue.component(props.component)
    if (Comp) {
      return createElement(Comp, {
        props: {
          iri: props.iri,
          sortValue: props.sortValue,
          showSort: props.showSort,
          isDynamic: props.isDynamic
        },
        class: {
          'highlight-component-only': !props.highlightIsPosition
        }
      })
    }
    return createElement(ErrorComponent, {
      props: {
        message:
          props.message ||
          `The component '<b>${props.component}</b>' specified by resource '<b>${props.iri}</b>' does not exist`,
        isDanger: true
      }
    })
  }
})
