import { config } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

// https://test-utils.vuejs.org/guide/extending-vtu/plugins.html#stubs-plugin
config.plugins.createStubs = function ({ name, component }) {
  const componentName = name || component.__file?.split('/').pop()?.replace('.vue', '')

  return defineComponent({
    name: `${componentName}`,
    props: component.props,
    setup(props, { slots }) {
      return () => h(`${componentName}-stub`, props, slots?.default?.())
    },
  })
}
