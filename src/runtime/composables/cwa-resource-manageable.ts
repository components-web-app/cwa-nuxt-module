import {
  getCurrentInstance,
  inject,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue'
import type { ComponentPublicInstance, Ref, WatchStopHandle } from 'vue'
import { consola as logger } from 'consola'
import type ManageableResource from '../admin/manageable-resource'
import type { ManageableResourceOps } from '../admin/manageable-resource'
import { lazyImport } from '../lazy-import'
import { useCwa } from './cwa'

const manageableResourceClass = lazyImport(() => import('../admin/manageable-resource').then(module => module.default))

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
  const managerOps = ops || ref({})
  const pageDepth = inject<number>('cwa-page-own-depth', 0)

  const manageableResource = shallowRef<ManageableResource>()
  const isAdmin = $cwa.auth.isAdmin
  let adminActive = false

  const onManageableComponentMounted = (iriMounted: string) => {
    if (iriMounted === iri.value && manageableResource.value) {
      manageableResource.value.initNewIri()
      if (iri.value) {
        $cwa.admin.resourceStackManager.refreshFocusForIri(iri.value, manageableResource.value.elements)
      }
      $cwa.admin.eventBus.emit('componentMounted', iri.value)
    }
  }

  const onComponentUpdated = (iriUpdated: string) => {
    if (iriUpdated === iri.value) {
      manageableResource.value?.refreshElements()
    }
  }

  const startManaging = (ManageableResourceClass: typeof ManageableResource) => {
    if (!adminActive) {
      return
    }
    manageableResource.value ??= new ManageableResourceClass(useProxy, $cwa, managerOps, pageDepth)
    manageableResource.value.init(iri)
    iri.value && $cwa.admin.eventBus.emit('componentMounted', iri.value)
  }

  const initAdmin = () => {
    adminActive = true
    if (manageableResourceClass.loaded) {
      startManaging(manageableResourceClass.loaded)
    }
    else {
      manageableResourceClass.load()
        .then(startManaging)
        .catch(error => logger.error('Could not load the admin manager for a resource', error))
    }
    $cwa.admin.eventBus.on('manageableComponentMounted', onManageableComponentMounted)
    $cwa.admin.eventBus.on('componentUpdated', onComponentUpdated)
  }

  const clearAdmin = () => {
    adminActive = false
    $cwa.admin.eventBus.off('manageableComponentMounted', onManageableComponentMounted)
    $cwa.admin.eventBus.off('componentUpdated', onComponentUpdated)
    manageableResource.value?.clear()
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
