import { useCwa } from './cwa'
import { CwaResourceTypes } from '@cwa/nuxt-module/runtime/resources/resource-utils'

export const useCwaComponent = (componentId: string) => {
  if (!componentId) {
    throw new Error('You should provide component id')
  }

  const cwa = useCwa();

  if (!cwa.checkResourceTypeExistence(componentId, CwaResourceTypes.COMPONENT)) {
    throw new Error('Resource you are trying to get does not exist or is not of a component type')
  }

  return cwa.resources.getResource(componentId)
}
