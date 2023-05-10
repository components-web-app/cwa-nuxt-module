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
