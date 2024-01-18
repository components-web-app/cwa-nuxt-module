import { getCurrentInstance, onBeforeUnmount, onMounted, reactive } from 'vue'
import type { ComponentPublicInstance, Ref } from 'vue'
import type { ManageableResourceOps } from '../admin/manageable-resource'
import ManageableResource from '../admin/manageable-resource'
import { useCwa } from './cwa'

/**
 * @internal
 * @description Advanced usage - usually this composable will be initialised from useCwaResource where disableManager does not equal true. Primarily separated for the ComponentGroup component
 */
export const useCwaResourceManageable = (iri: Ref<string|undefined>, ops?: ManageableResourceOps, proxy?: ComponentPublicInstance) => {
  const useProxy = proxy || getCurrentInstance()?.proxy
  if (!useProxy) {
    throw new Error(`Cannot initialise manager for resource. Instance is not defined with iri '${iri.value}'`)
  }

  const manageableResource = new ManageableResource(useProxy, useCwa(), ops || reactive({}))

  onMounted(() => {
    manageableResource.init(iri)
  })

  onBeforeUnmount(() => {
    manageableResource.clear()
  })

  return {
    manager: manageableResource
  }
}
