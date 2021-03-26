import Vue from 'vue'
import ErrorComponent from '@cwa/nuxt-module/core/templates/components/core/component-load-error.vue'

export default {
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
          iri: props.iri
        }
      })
    }
    return createElement(ErrorComponent, {
      props: {
        message:
          props.message ||
          `The component <b>${props.component}</b> specified by resource <b>${props.iri}</b> does not exist`,
        isDanger: true
      }
    })
  }
}
