import { onMounted } from 'vue'
import { useCwa } from './cwa'
import { useCwaResourceManageable } from './cwa-resource-manageable'

export type IriProp = {
 iri: string
}

interface CwaResourceUtilsOps {
  iri?: string
  disableManager?: boolean
  displayName?: string
}

export const useCwaResource = (iri: string, ops?: CwaResourceUtilsOps) => {
  const $cwa = useCwa()
  const manager = !ops?.disableManager ? useCwaResourceManageable(iri, { displayName: ops?.displayName }) : undefined

  onMounted(() => {
    $cwa.admin.eventBus.emit('componentMounted', iri)
  })

  return {
    manager,
    // this needs to be a function so useCwa is not called early - would get issues from ComponentPosition and more
    getResource: () => $cwa.resources.getResource(iri)
  }
}
