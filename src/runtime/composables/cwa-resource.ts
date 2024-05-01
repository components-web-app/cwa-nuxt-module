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

  // @ts-ignore-next-line
  const disableManager = !!ops?.manager?.disabled

  onMounted(() => {
    // todo: !! But needs to be done here, or when this component is mounted and not the parent component position resource
    // we need to emit this after we have already init manageable component so the first click event is this resource to clear the stack
    // otherwise the stack will not be cleared when the first event already is a resource existing in the current stack, clicking from one to another in same group
    // this is for adding a new resource where click events have already been assigned to the group etc. and clicking between components
    $cwa.admin.eventBus.emit(disableManager ? 'componentMounted' : 'manageableComponentMounted', iri.value)
  })

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
