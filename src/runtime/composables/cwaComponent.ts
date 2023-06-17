import { useCwa } from './cwa'

export const iri = {
  iri: {
    type: String,
    required: true
  }
}

export const useCwaResourceUtils = () => {
  return {
    getResource: useCwa().resources.getResource
  }
}

export interface CwaResourceIdProp {
  resourceId: string
}
