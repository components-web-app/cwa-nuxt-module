import { computed, onMounted } from 'vue'
import type { Ref } from 'vue'
import { useCwa } from './cwa'
import type { StyleOptions } from '#cwa/runtime/admin/manageable-resource'

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
    styles?: StyleOptions
  },
  disableManager: boolean
}

export const useCwaResource = (iri: Ref<string>, ops?: CwaResourceUtilsOps) => {
  const $cwa = useCwa()

  onMounted(() => {
    $cwa.admin.eventBus.emit('componentMounted', iri.value)
  })

  // @ts-ignore-next-line
  const disableManager = !!ops?.manager?.disabled

  const exposeMeta: CwaResourceMeta = {
    cwaResource: {
      name: ops?.name,
      styles: ops?.styles
    },
    disableManager
  }

  return {
    $cwa,
    // this needs to be a function so useCwa is not called early - would get issues from ComponentPosition and more
    getResource: () => computed(() => $cwa.resources.getResource(iri.value).value),
    exposeMeta
  }
}
