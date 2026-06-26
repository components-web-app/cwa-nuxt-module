import type { CwaResource } from '#cwa/resources/resource-utils'
import isEqual from 'lodash-es/isEqual'
import { computed, getCurrentInstance, onMounted, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { useCwa } from './cwa'
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

  if (ops?.autoClass !== false) {
    const activeSet: string[] = []

    // classList.add/remove/contains require individual tokens — split space-separated entries
    function tokenize(classes: string[]): string[] {
      return classes.flatMap(c => c.split(/\s+/).filter(Boolean))
    }

    function applyClasses(newClasses: string[] | undefined) {
      const el = instance?.proxy?.$el
      if (!el || el.nodeType !== 1 || !el.isConnected) return
      const tokens = tokenize(newClasses ?? [])
      if (tokens.length > 0 && tokens.every((cls: string) => el.classList.contains(cls))) {
        // All classes already present — user is managing them manually; stay passive
        activeSet.length = 0
        return
      }
      const toRemove = activeSet.filter((c: string) => !tokens.includes(c))
      const toAdd = tokens.filter((c: string) => !el.classList.contains(c))
      for (const cls of toRemove) el.classList.remove(cls)
      for (const cls of toAdd) el.classList.add(cls)
      activeSet.length = 0
      activeSet.push(...tokens)
    }

    onMounted(() => applyClasses(uiClassNames.value))

    watch(uiClassNames, newClasses => applyClasses(newClasses), { flush: 'post' })
  }

  const getCurrentStyleName = (resource: CwaResource) => {
    if (!uiStyles?.classes) return
    const currentClassNames = resource.uiClassNames
    for (const [name, classes] of Object.entries(uiStyles.classes)) {
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
    uiClassNames,
  }
}
