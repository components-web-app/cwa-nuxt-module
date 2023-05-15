import { useCwa } from './cwa'

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

export interface CwaResourceIdProp {
  resourceId: string
}
