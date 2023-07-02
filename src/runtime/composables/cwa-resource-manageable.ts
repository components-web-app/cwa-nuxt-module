import { getCurrentInstance, onBeforeUnmount, onMounted } from 'vue'
import logger from 'consola'
import ManageableComponent from '../admin/manageable-component'
import { useCwa } from './cwa'

/**
 * @internal
 * @description Advanced usage - usually this composable will be initialised from useCwaResource where disableManager does not equal true. Primarily separated for the ComponentGroup component
 * @param iri
 */
export const useCwaResourceManageable = (iri?: string) => {
  const proxy = getCurrentInstance()?.proxy
  if (!proxy) {
    logger.error('Cannot initialise manager for resource. Instance is not defined')
    return
  }

  const manageableComponent = new ManageableComponent(proxy, useCwa())

  onMounted(() => {
    if (iri) {
      manageableComponent.initCwaManagerResource(iri)
    }
  })

  onBeforeUnmount(() => {
    manageableComponent.destroyCwaManagerResource()
  })

  return manageableComponent
}
