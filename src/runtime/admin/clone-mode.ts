import { effectScope, shallowReadonly, shallowRef, watch } from 'vue'
import type { EffectScope, Ref } from 'vue'
import type Cwa from '#cwa/cwa'

export interface CloneMove {
  positionIri: string
  fromLayout: boolean
}

export interface CloneSource {
  iri: string
  name?: string
  move?: CloneMove
}

export interface CloneMode {
  source: Readonly<Ref<CloneSource | undefined>>
  start: (iri: string, name?: string, move?: CloneMove) => void
  end: () => void
}

const cloneModes = new WeakMap<Cwa, CloneMode>()

function isDialogOpen() {
  return !!document.querySelector('[role="dialog"], [aria-modal="true"]')
}

function createCloneMode($cwa: Cwa): CloneMode {
  const source = shallowRef<CloneSource | undefined>()
  let scope: EffectScope | undefined
  let navigationOffTimer: ReturnType<typeof setTimeout> | undefined

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || event.defaultPrevented || isDialogOpen()) {
      return
    }
    end()
  }

  function stopListening() {
    clearTimeout(navigationOffTimer)
    scope?.stop()
    scope = undefined
    window.removeEventListener('keydown', onKeydown)
  }

  function start(iri: string, name?: string, move?: CloneMove) {
    stopListening()
    source.value = move ? { iri, name, move } : { iri, name }
    $cwa.admin.setNavigationGuardDisabled(true)
    let navigatingFrom = $cwa.resources.displayPageIri.value
    scope = effectScope(true)
    scope.run(() => {
      watch(() => $cwa.admin.navigationGuardDisabled, (enabled) => {
        if (enabled) {
          navigatingFrom = $cwa.resources.displayPageIri.value
        }
      })
      watch(() => $cwa.resources.displayPageIri.value, (pageIri) => {
        if (pageIri && pageIri !== navigatingFrom) {
          navigatingFrom = pageIri
          clearTimeout(navigationOffTimer)
          navigationOffTimer = setTimeout(() => $cwa.admin.setNavigationGuardDisabled(false))
        }
      })
      watch(() => $cwa.admin.isEditing, (isEditing) => {
        if (!isEditing) {
          end()
        }
      })
      watch(() => $cwa.auth.user, (user) => {
        if (!user) {
          end()
        }
      })
    })
    window.addEventListener('keydown', onKeydown)
  }

  function end() {
    stopListening()
    $cwa.admin.setNavigationGuardDisabled(false)
    source.value = undefined
  }

  return {
    source: shallowReadonly(source),
    start,
    end,
  }
}

export function useCloneMode($cwa: Cwa): CloneMode {
  let mode = cloneModes.get($cwa)
  if (!mode) {
    mode = createCloneMode($cwa)
    cloneModes.set($cwa, mode)
  }
  return mode
}
