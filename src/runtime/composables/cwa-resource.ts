import { onMounted } from 'vue'
import { useCwa } from './cwa'
import { useCwaResourceManageable } from './cwa-resource-manageable'

export type IriProp = {
 iri: string
}

interface cwaResourceUtilsOps {
  iri: string
  disableManager?: boolean
}

export const useCwaResource = (iri: string, ops?: cwaResourceUtilsOps) => {
  const $cwa = useCwa()
  const manager = !ops?.disableManager ? useCwaResourceManageable(iri) : undefined

  onMounted(() => {
    $cwa.eventBus.emit('componentMounted', iri)
  })

  return {
    manager,
    // this needs to be a function so useCwa is not called early - would get issues from ComponentPosition and more
    getResource: () => $cwa.resources.getResource(iri)
  }
}
