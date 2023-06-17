import { useCwa } from './cwa'

export const iri = {
  iri: {
    type: String,
    required: true
  }
}

export const useCwaResourceUtils = () => {
  return {
    // this needs to be a function so useCwa is not called early - would get issues from ComponentPosition and more
    getResource: (id:string) => useCwa().resources.getResource(id)
  }
}

export interface CwaResourceIdProp {
  resourceId: string
}
