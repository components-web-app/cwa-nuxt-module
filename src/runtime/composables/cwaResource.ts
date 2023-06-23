import { useCwa } from './cwa'

export type IriProp = {
 iri: string
}

interface cwaResourceUtilsOps {}

export const useCwaResourceUtils = (_: cwaResourceUtilsOps) => {
  return {
    // this needs to be a function so useCwa is not called early - would get issues from ComponentPosition and more
    getResource: (id:string) => useCwa().resources.getResource(id)
  }
}
