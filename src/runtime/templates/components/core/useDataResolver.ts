import { createApp, defineComponent, h, ref, type Ref, watchEffect } from 'vue'
import { useNuxtApp } from '#app'
import type { ManagerTab } from '#cwa/module.js'

interface Options {
  components: Ref<ManagerTab[]|undefined>
  props: Ref<any>
}

export const useDataResolver = <T extends object>(allMeta: Ref<(T|null)[]>, ops: Options) => {
  allMeta.value = []

  const nuxtApp = useNuxtApp()
  const globalComponents = nuxtApp.vueApp._context.components

  const rootDefinition = defineComponent(
    (props: { component: ManagerTab, cProps: any }, { expose }) => {
      const metadata = ref<T|null>(null)
      const possibleAsyncDefinition =
        typeof props.component === 'string'
          ? globalComponents[props.component]
          : props.component
      if (possibleAsyncDefinition === undefined) {
        throw new Error('Cannot load metadata for component')
      }
      expose({
        metadata
      })
      return () => {
        return h(possibleAsyncDefinition, { ...props.cProps, ref: metadata })
      }
    },
    {
      // eslint-disable-next-line vue/require-prop-types
      props: ['component', 'cProps']
    }
  )

  watchEffect(() => {
    allMeta.value = []
    if (!ops.components.value) {
      return
    }

    for (const cName of ops.components.value) {
      const wrapper = document.createElement('div')
      const component = createApp(rootDefinition, { cProps: ops.props.value, component: cName })
      const instance = component.mount(wrapper)
      allMeta.value.push(instance.$.exposed?.metadata.value)
      // todo: we need to unmount but only after the async child was loaded - and move the wrapper so we do not create loads of virtual nodes
      // component.unmount()
    }
  })
}
