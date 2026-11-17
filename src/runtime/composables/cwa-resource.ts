import type { CwaResource } from '#cwa/resources/resource-utils'
import { computed, getCurrentInstance, onMounted, onUpdated } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { useCwa } from './cwa'

export type IriProp = {
  iri: string
}

export interface CwaResourceUtilsOps {
  name?: string
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
  }
  disableManager: boolean
}

export const useCwaResource = (iri: Ref<string>, ops?: CwaResourceUtilsOps) => {
  const $cwa = useCwa()
  const instance = getCurrentInstance()

  const disableManager = !!ops?.manager?.disabled

  const isDetached = () => {
    const el = instance?.proxy?.$el
    return !!el && !el.isConnected
  }

  onMounted(() => {
    // todo: !! But needs to be done here, or when this component is mounted and not the parent component position resource
    // we need to emit this after we have already init manageable component so the first click event is this resource to clear the stack
    // otherwise the stack will not be cleared when the first event already is a resource existing in the current stack, clicking from one to another in same group
    // this is for adding a new resource where click events have already been assigned to the group etc. and clicking between components
    if (isDetached()) {
      return
    }
    $cwa.admin.eventBus.emit(disableManager ? 'componentMounted' : 'manageableComponentMounted', iri.value)
  })

  onUpdated(() => {
    if (!$cwa.auth.isAdmin.value || isDetached()) {
      return
    }
    $cwa.admin.eventBus.emit('componentUpdated', iri.value)
  })

  const exposeMeta: CwaResourceMeta = {
    cwaResource: {
      name: ops?.name,
    },
    disableManager,
  }

  const getResource = () => {
    return computed(() => $cwa.resources.getResource(iri.value).value)
  }

  const uiClassNames = computed<string[] | undefined>(() => {
    return $cwa.resources.getResource(iri.value)?.value?.data?.uiClassNames
  })

  const getCurrentStyleName = (resource: CwaResource): string | undefined => {
    return (resource.uiClassNames as string[] | undefined)?.find(entry => entry.startsWith('style:'))?.slice('style:'.length)
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
