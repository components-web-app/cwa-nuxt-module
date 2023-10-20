import { computed, onMounted, Ref } from 'vue'
import { useCwa } from './cwa'
import { useCwaResourceManageable } from './cwa-resource-manageable'

export type IriProp = {
 iri: string
}

interface CwaResourceUtilsOps {
  name?: string
  manager?: {
    disabled?: boolean
  }
}

export const useCwaResource = (iri: Ref<string>, ops?: CwaResourceUtilsOps) => {
  const $cwa = useCwa()

  const manager = !ops?.manager?.disabled ? useCwaResourceManageable(iri) : undefined

  if (!manager) {
    onMounted(() => {
      $cwa.admin.eventBus.emit('componentMounted', iri.value)
    })
  }

  return {
    manager,
    // this needs to be a function so useCwa is not called early - would get issues from ComponentPosition and more
    getResource: () => computed(() => $cwa.resources.getResource(iri.value).value),
    exposeMeta: {
      cwaResource: {
        name: ops?.name
      }
    }
  }
}
