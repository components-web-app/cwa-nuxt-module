import { getCurrentInstance, onBeforeUnmount, onMounted, watch } from 'vue'
import { Ref } from 'vue/dist/vue'
import ManageableComponent from '../admin/manageable-component'
import { useCwa } from './cwa'

interface ManageableResourceOps {
  watch: boolean
}

/**
 * @internal
 * @description Advanced usage - usually this composable will be initialised from useCwaResource where disableManager does not equal true. Primarily separated for the ComponentGroup component
 */
export const useCwaResourceManageable = (iri: Ref<string|undefined>, ops: ManageableResourceOps = { watch: true }) => {
  const proxy = getCurrentInstance()?.proxy
  if (!proxy) {
    throw new Error(`Cannot initialise manager for resource. Instance is not defined with iri '${iri.value}'`)
  }

  const manageableComponent = new ManageableComponent(proxy, useCwa())

  onMounted(() => {
    if (ops.watch) {
      watch(iri, () => {
        manageableComponent.init(iri)
      }, {
        immediate: true,
        flush: 'post'
      })
      return
    }
    manageableComponent.init(iri)
  })

  onBeforeUnmount(() => {
    manageableComponent.clear()
  })

  return {
    manager: manageableComponent
  }
}
