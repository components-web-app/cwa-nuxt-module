import { getCurrentInstance, onBeforeUnmount, onMounted } from 'vue'
import type { Ref } from 'vue/dist/vue'
import ManageableComponent from '../admin/manageable-component'
import { useCwa } from './cwa'

/**
 * @internal
 * @description Advanced usage - usually this composable will be initialised from useCwaResource where disableManager does not equal true. Primarily separated for the ComponentGroup component
 */
export const useCwaResourceManageable = (iri: Ref<string|undefined>) => {
  const proxy = getCurrentInstance()?.proxy
  if (!proxy) {
    throw new Error(`Cannot initialise manager for resource. Instance is not defined with iri '${iri.value}'`)
  }

  const manageableComponent = new ManageableComponent(proxy, useCwa())

  onMounted(() => {
    manageableComponent.init(iri)
  })

  onBeforeUnmount(() => {
    manageableComponent.clear()
  })

  return {
    manager: manageableComponent
  }
}
