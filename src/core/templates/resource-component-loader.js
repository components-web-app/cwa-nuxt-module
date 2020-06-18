import Vue from 'vue'
import ErrorComponent from './resource-component-load-error'

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
    resource: {
      required: true,
      type: Object
    }
  },
  render: (createElement, { props, parent }) => {
    let Comp = (parent.$options.components && parent.$options.components[props.component]) || Vue.component(props.component)
    return Comp ? createElement(Comp, { props: { resource: props.resource }}) : createElement(ErrorComponent, {
      props: {
        message: props.message || `The component <b>${props.component}</b> specified by resource <b>${props.resource['@id']}</b> does not exist`
      }
    })
  }
}
