import {
  createApp,
  type defineAsyncComponent,
  defineComponent,
  h,
  ref,
  type Ref,
  watch,
  type WatchStopHandle
} from 'vue'
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
      const resolved = ref(false)
      const possibleAsyncDefinition: ReturnType<typeof defineAsyncComponent> =
        typeof props.component === 'string'
          ? globalComponents[props.component]
          : props.component
      if (possibleAsyncDefinition === undefined) {
        throw new Error('Cannot load metadata for component')
      }

      if (possibleAsyncDefinition.name !== 'AsyncComponentWrapper') {
        resolved.value = true
      } else {
        // @ts-ignore-next-line
        const isAsyncResolved = () => !!possibleAsyncDefinition.__asyncResolved

        resolved.value = isAsyncResolved()
        if (!resolved.value) {
          const interval = window.setInterval(() => {
            if (isAsyncResolved()) {
              resolved.value = true
              window.clearInterval(interval)
            }
          }, 10)
        }
      }

      expose({
        metadata,
        resolved
      })
      return () => {
        return h(possibleAsyncDefinition, { ...props.cProps, ref: metadata })
      }
    },
    // eslint-disable-next-line vue/one-component-per-file
    {
      // eslint-disable-next-line vue/require-prop-types
      props: ['component', 'cProps']
    }
  )

  const resolvedWatchers = ref<WatchStopHandle[]>([])

  watch([ops.components, ops.props], () => {
    for (const unwatch of resolvedWatchers.value) {
      unwatch()
    }
    resolvedWatchers.value = []
    allMeta.value = new Array(ops.components.value?.length || 0)

    if (!ops.components.value) {
      return
    }

    for (const [index, cName] of ops.components.value.entries()) {
      const wrapper = document.createElement('div')
      // eslint-disable-next-line vue/one-component-per-file
      const component = createApp(rootDefinition, { cProps: ops.props.value, component: cName })
      const instance = component.mount(wrapper)
      const exposed = instance.$.exposed
      if (!exposed) {
        continue
      }
      const completeLoad = () => {
        allMeta.value.splice(index, 1, exposed.metadata.value)
        component.unmount()
      }
      if (exposed.resolved.value) {
        completeLoad()
        continue
      }

      const unwatch = watch(exposed.resolved, (isResolved, wasResolved) => {
        if (!wasResolved && isResolved) {
          completeLoad()
          unwatch()
        }
      })
      resolvedWatchers.value.push(unwatch)
    }
  }, {
    immediate: true
  })
}
