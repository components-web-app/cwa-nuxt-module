import { getCurrentInstance, onBeforeUnmount, onMounted, reactive } from 'vue'
import type { ComponentPublicInstance, Ref } from 'vue'
import type { ManageableComponentOps } from '../admin/manageable-component'
import ManageableComponent from '../admin/manageable-component'
import { useCwa } from './cwa'

/**
 * @internal
 * @description Advanced usage - usually this composable will be initialised from useCwaResource where disableManager does not equal true. Primarily separated for the ComponentGroup component
 */
export const useCwaResourceManageable = (iri: Ref<string|undefined>, ops?: ManageableComponentOps, proxy?: ComponentPublicInstance) => {
  const useProxy = proxy || getCurrentInstance()?.proxy
  if (!useProxy) {
    throw new Error(`Cannot initialise manager for resource. Instance is not defined with iri '${iri.value}'`)
  }

  const manageableComponent = new ManageableComponent(useProxy, useCwa(), ops || reactive({}))

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
