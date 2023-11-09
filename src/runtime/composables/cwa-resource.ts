import { computed, onMounted, getCurrentInstance } from 'vue'
import type { Ref } from 'vue'
import { useCwa } from './cwa'
import { useCwaResourceManageable } from './cwa-resource-manageable'
import type { StyleOptions } from '#cwa/runtime/admin/manageable-component'

export type IriProp = {
 iri: string
}

interface CwaResourceUtilsOps {
  name?: string
  styles?: StyleOptions,
  manager?: {
    disabled?: boolean
  }
}

export interface CwaResourceMeta {
  cwaResource: {
    name?: string
  }
}

export const useCwaResource = (iri: Ref<string>, ops?: CwaResourceUtilsOps) => {
  const $cwa = useCwa()
  const proxy = getCurrentInstance()?.proxy
  const disableManager = ops?.manager?.disabled || proxy?.$parent?.$parent?.cwaMetaResolver
  const manager = !disableManager
    ? useCwaResourceManageable(iri, {
      styles: ops?.styles
    })
    : undefined

  if (!manager) {
    onMounted(() => {
      $cwa.admin.eventBus.emit('componentMounted', iri.value)
    })
  }
  const exposeMeta: CwaResourceMeta = {
    cwaResource: {
      name: ops?.name
    }
  }

  return {
    $cwa,
    manager,
    // this needs to be a function so useCwa is not called early - would get issues from ComponentPosition and more
    getResource: () => computed(() => $cwa.resources.getResource(iri.value).value),
    exposeMeta
  }
}
