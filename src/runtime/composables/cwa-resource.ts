import type { CwaResource } from '#cwa/resources/resource-utils'
import { computed, getCurrentInstance, onMounted } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { useCwa } from './cwa'
import { useCwaAutoClass } from './cwa-auto-class'
import { deriveSelectedStyles } from './cwa-styles'
import type { StyleOptions } from '#cwa/admin/manageable-resource'

export type IriProp = {
  iri: string
}

export interface CwaResourceUtilsOps {
  name?: string
  styles?: StyleOptions
  autoClass?: boolean
  manager?: {
    disabled?: boolean
  }
}

export interface CwaResourceUiClassNames {
  uiClassNames: ComputedRef<string[] | undefined>
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
  const instance = getCurrentInstance()

  const disableManager = !!ops?.manager?.disabled

  onMounted(() => {
    // todo: !! But needs to be done here, or when this component is mounted and not the parent component position resource
    // we need to emit this after we have already init manageable component so the first click event is this resource to clear the stack
    // otherwise the stack will not be cleared when the first event already is a resource existing in the current stack, clicking from one to another in same group
    // this is for adding a new resource where click events have already been assigned to the group etc. and clicking between components
    // Guard: skip emit when rendered in a detached DOM tree (e.g. useDataResolver metadata extraction) — those renders should not trigger admin re-init on page components.
    const el = instance?.proxy?.$el
    if (el && !el.isConnected) {
      return
    }
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

  const uiClassNames = computed<string[] | undefined>(() => {
    return $cwa.resources.getResource(iri.value)?.value?.data?.uiClassNames
  })

  useCwaAutoClass(uiClassNames, ops)

  // The first selected style name (styles map to one uiClassNames entry each — see cwa-styles).
  const getCurrentStyleName = (resource: CwaResource) => {
    if (!uiStyles?.classes) return
    return deriveSelectedStyles(resource.uiClassNames, uiStyles.classes)[0]
  }

  return {
    $cwa,
    // this needs to be a function so useCwa is not called early - would get issues from ComponentPosition and more
    getResource,
    exposeMeta,
    getCurrentStyleName,
    uiClassNames,
  }
}
