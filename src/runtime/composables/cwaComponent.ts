import { useCwa } from './cwa'
import { GroupSynchronizer } from '#cwa/runtime/api/group-synchronizer'

export const iri = {
  iri: {
    type: String,
    required: true
  }
}

export const useCwaResource = (resourceId: string) => {
  return useCwa().resources.getResource(resourceId)
}

export const useCwaResourceUtils = () => {
  return {
    getResource: useCwa().resources.getResource
  }
}

export const useSynchronizer = () => {
  const { auth, resources, resourcesManager } = useCwa()

  return new GroupSynchronizer(resourcesManager, resources, auth)
}

export interface CwaResourceIdProp {
  resourceId: string
}
