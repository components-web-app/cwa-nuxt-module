import { useNuxtApp } from '#imports'
import {
  defineComponent,
  effectScope,
  h, onBeforeUnmount, onErrorCaptured, onMounted, provide,
  ref,
  toRaw,
  watch,
  render,
} from 'vue'
import type { defineAsyncComponent, EffectScope, Ref, WatchStopHandle } from 'vue'
import { consola } from 'consola'
import type { ManagerTab } from '#cwa/types'
import { tabMetaOnlyKey } from '#cwa/templates/components/core/ui/field-keys'

interface Options {
  components: Ref<ManagerTab[] | undefined>
  props: Ref<any>
  propsValidator?: (props: any) => boolean
}

export const useDataResolver = <T extends object>(allMeta: Ref<(T | null)[]>, ops: Options) => {
  allMeta.value = []

  const nuxtApp = useNuxtApp()
  const globalComponents = nuxtApp.vueApp._context.components

  const rootDefinition = defineComponent(
    (props: { component: ManagerTab, cProps: any }, { expose }) => {
      provide(tabMetaOnlyKey, true)
      const metadata = ref<T | null>(null)
      const resolved = ref(false)
      const failed = ref(false)
      const possibleAsyncDefinition: ReturnType<typeof defineAsyncComponent> | undefined
        = typeof props.component === 'string'
          ? globalComponents[props.component]
          : toRaw(props.component)

      if (possibleAsyncDefinition === undefined) {
        throw new Error('Cannot load metadata for component')
      }

      onErrorCaptured((error) => {
        if (!failed.value && import.meta.env.DEV) {
          const name = typeof props.component === 'string' ? props.component : (possibleAsyncDefinition.name ?? 'a component')
          consola.warn(`[CWA] ${name} could not be rendered to read its metadata, so its UIs and styles are not offered.`, error)
        }
        failed.value = true
        return false
      })

      let interval: number | undefined
      onBeforeUnmount(() => window.clearInterval(interval))

      if (possibleAsyncDefinition.name !== 'AsyncComponentWrapper') {
        resolved.value = true
      }
      else {
        // @ts-expect-error-next-line
        const isAsyncResolved = () => !!possibleAsyncDefinition.__asyncResolved

        resolved.value = isAsyncResolved()
        if (!resolved.value) {
          interval = window.setInterval(() => {
            if (isAsyncResolved()) {
              resolved.value = true
              window.clearInterval(interval)
            }
          }, 10)
        }
      }

      expose({
        metadata,
        resolved,
        failed,
      })
      return () => {
        return h(possibleAsyncDefinition, { ...props.cProps, ref: metadata })
      }
    },
    {
      props: ['component', 'cProps'],
    },
  )

  let runScope: EffectScope | undefined
  const unfinished = new Set<HTMLElement>()

  const clearRun = () => {
    runScope?.stop()
    runScope = undefined
    for (const wrapper of unfinished) {
      render(null, wrapper)
    }
    unfinished.clear()
  }

  const handleInputChange = () => {
    clearRun()
    allMeta.value = new Array(ops.components.value?.length || 0)

    if (!ops.components.value || (ops.propsValidator && !ops.propsValidator(ops.props.value))) {
      return
    }

    const scope = effectScope(true)
    runScope = scope

    for (const [index, cName] of ops.components.value.entries()) {
      const wrapper = document.createElement('div')

      const vnode = h(rootDefinition, {
        cProps: ops.props.value,
        component: cName,
      })
      vnode.appContext = nuxtApp.vueApp._context
      render(vnode, wrapper)
      const exposed = vnode.component?.exposed

      if (!exposed) {
        render(null, wrapper)
        continue
      }
      const isComplete = () => exposed.failed.value || (exposed.resolved.value && exposed.metadata.value !== null)
      const completeLoad = () => {
        allMeta.value.splice(index, 1, exposed.metadata.value)
        unfinished.delete(wrapper)
        render(null, wrapper)
      }
      if (isComplete()) {
        completeLoad()
        continue
      }

      unfinished.add(wrapper)
      scope.run(() => {
        const unwatch: WatchStopHandle = watch(isComplete, (complete) => {
          if (complete) {
            unwatch()
            completeLoad()
          }
        })
      })
    }
  }

  let stopPrimaryWatch: WatchStopHandle | undefined
  const startDataResolver = () => {
    if (stopPrimaryWatch) {
      return
    }
    allMeta.value = []
    stopPrimaryWatch = watch([ops.components, ops.props], handleInputChange, {
      immediate: true,
    })
  }

  const stopDataResolver = () => {
    stopPrimaryWatch?.()
    stopPrimaryWatch = undefined
    clearRun()
  }

  onMounted(() => {
    startDataResolver()
  })

  onBeforeUnmount(() => {
    stopDataResolver()
  })

  return {
    startDataResolver,
    stopDataResolver,
  }
}
