import type { CwaResource } from '#cwa/resources/resource-utils'
import isEqual from 'lodash-es/isEqual'
import { computed, onMounted } from 'vue'
import type { Ref } from 'vue'
import { useCwa } from './cwa'
import type { StyleOptions } from '#cwa/admin/manageable-resource'

export type IriProp = {
  iri: string
}

export interface CwaResourceUtilsOps {
  name?: string
  styles?: StyleOptions
  manager?: {
    disabled?: boolean
  }
}

export interface CwaResourceMeta {
  cwaResource: {
    name?: string
    styles?: StyleOptions
  }
  disableManager: boolean
}

export const useCwaResource = (iri: Ref<string>, ops?: CwaResourceUtilsOps) => {
  const $cwa = useCwa()

  const disableManager = !!ops?.manager?.disabled

  onMounted(() => {
    // todo: !! But needs to be done here, or when this component is mounted and not the parent component position resource
    // we need to emit this after we have already init manageable component so the first click event is this resource to clear the stack
    // otherwise the stack will not be cleared when the first event already is a resource existing in the current stack, clicking from one to another in same group
    // this is for adding a new resource where click events have already been assigned to the group etc. and clicking between components
    $cwa.admin.eventBus.emit(disableManager ? 'componentMounted' : 'manageableComponentMounted', iri.value)
  })

  const uiStyles = ops?.styles
  const exposeMeta: CwaResourceMeta = {
    cwaResource: {
      name: ops?.name,
      styles: uiStyles,
    },
    disableManager,
  }

  const getResource = () => {
    return computed(() => $cwa.resources.getResource(iri.value).value)
  }

  const getCurrentStyleName = (resource: CwaResource) => {
    if (!uiStyles) return
    const currentClassNames = resource.uiClassNames
    for (const [name, classes] of Object.entries(uiStyles)) {
      if (isEqual(currentClassNames, classes)) {
        return name
      }
    }
  }

  return {
    $cwa,
    // this needs to be a function so useCwa is not called early - would get issues from ComponentPosition and more
    getResource,
    exposeMeta,
    getCurrentStyleName,
  }
}
