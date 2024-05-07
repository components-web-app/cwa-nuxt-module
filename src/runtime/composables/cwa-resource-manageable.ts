import {
  getCurrentInstance,
  onBeforeUnmount,
  onMounted,
  ref,
  type ComponentPublicInstance,
  type Ref
} from 'vue'
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
  const $cwa = useCwa()

  const manageableResource = new ManageableResource(useProxy, $cwa, ops || ref({}))

  onMounted(() => {
    manageableResource.init(iri)

    iri.value && $cwa.admin.eventBus.emit('componentMounted', iri.value)

    $cwa.admin.eventBus.on('manageableComponentMounted', (iriMounted) => {
      if (iriMounted === iri.value) {
        manageableResource.initNewIri()
        $cwa.admin.eventBus.emit('componentMounted', iri.value)
      }
    })
  })

  onBeforeUnmount(() => {
    manageableResource.clear()
  })

  return {
    manager: manageableResource
  }
}
