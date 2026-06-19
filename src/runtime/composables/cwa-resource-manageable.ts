import {
  getCurrentInstance,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import type { ComponentPublicInstance, Ref, WatchStopHandle } from 'vue'
import type { ManageableResourceOps } from '../admin/manageable-resource'
import ManageableResource from '../admin/manageable-resource'
import { useCwa } from './cwa'

/**
 * @internal
 * @description Advanced usage - usually this composable will be initialised from useCwaResource where disableManager does not equal true. Primarily separated for the ComponentGroup component
 */
export const useCwaResourceManageable = (iri: Ref<string | undefined>, ops?: ManageableResourceOps, proxy?: ComponentPublicInstance) => {
  const useProxy = proxy || getCurrentInstance()?.proxy
  if (!useProxy) {
    throw new Error(`Cannot initialise manager for resource. Instance is not defined with iri '${iri.value}'`)
  }
  const $cwa = useCwa()

  const manageableResource = new ManageableResource(useProxy, $cwa, ops || ref({}))
  const isAdmin = $cwa.auth.isAdmin

  const onManageableComponentMounted = (iriMounted: string) => {
    if (iriMounted === iri.value) {
      manageableResource.initNewIri()
      if (iri.value) {
        $cwa.admin.resourceStackManager.refreshFocusForIri(iri.value, manageableResource.elements)
      }
      $cwa.admin.eventBus.emit('componentMounted', iri.value)
    }
  }

  const initAdmin = () => {
    manageableResource.init(iri)
    iri.value && $cwa.admin.eventBus.emit('componentMounted', iri.value)
    $cwa.admin.eventBus.on('manageableComponentMounted', onManageableComponentMounted)
  }

  const clearAdmin = () => {
    $cwa.admin.eventBus.off('manageableComponentMounted', onManageableComponentMounted)
    manageableResource.clear()
  }

  let stopAdminWatch: WatchStopHandle | undefined

  onMounted(() => {
    if (isAdmin.value) {
      initAdmin()
    }
    stopAdminWatch = watch(isAdmin, (isAdminValue, wasAdmin) => {
      if (isAdminValue && !wasAdmin) {
        initAdmin()
      }
      else if (!isAdminValue && wasAdmin) {
        clearAdmin()
      }
    })
  })

  onBeforeUnmount(() => {
    stopAdminWatch?.()
    clearAdmin()
  })

  return {
    manager: manageableResource,
  }
}
