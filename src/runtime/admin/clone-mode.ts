import { effectScope, shallowReadonly, shallowRef, watch } from 'vue'
import type { EffectScope, Ref } from 'vue'
import type Cwa from '#cwa/cwa'

export type MoveFrom = { componentPosition: string } | { pageData: string, property: string }

export interface CloneMove {
  positionIri: string
  fromLayout: boolean
  from: MoveFrom
}

export interface CloneOrigin {
  positionIri?: string
  excerpt?: string
}

export interface CloneSource extends CloneOrigin {
  iri: string
  name?: string
  move?: CloneMove
}

export interface CloneMode {
  source: Readonly<Ref<CloneSource | undefined>>
  placed: Readonly<Ref<string | undefined>>
  start: (iri: string, name?: string, move?: CloneMove, origin?: CloneOrigin) => void
  end: () => void
  showPlaced: (positionIri: string) => void
}

export const PLACED_FLASH_MS = 1500

const EXCERPT_LENGTH = 24

export function excerptOf(elements: readonly Node[]): string | undefined {
  const text = elements.map(element => element.textContent ?? '').join(' ').replace(/\s+/g, ' ').trim()
  if (!text) {
    return
  }
  if (text.length <= EXCERPT_LENGTH) {
    return text
  }
  const cut = text.slice(0, EXCERPT_LENGTH)
  const space = cut.lastIndexOf(' ')
  return `${(space > 0 ? cut.slice(0, space) : cut).trimEnd()}…`
}

const cloneModes = new WeakMap<Cwa, CloneMode>()

function isDialogOpen() {
  return !!document.querySelector('[role="dialog"], [aria-modal="true"]')
}

function createCloneMode($cwa: Cwa): CloneMode {
  const source = shallowRef<CloneSource | undefined>()
  const placed = shallowRef<string | undefined>()
  let placedTimer: ReturnType<typeof setTimeout> | undefined
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

  function clearPlaced() {
    clearTimeout(placedTimer)
    placed.value = undefined
  }

  function showPlaced(positionIri: string) {
    clearPlaced()
    placed.value = positionIri
    placedTimer = setTimeout(clearPlaced, PLACED_FLASH_MS)
  }

  function start(iri: string, name?: string, move?: CloneMove, origin: CloneOrigin = {}) {
    stopListening()
    clearPlaced()
    source.value = move ? { iri, name, ...origin, move } : { iri, name, ...origin }
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
    placed: shallowReadonly(placed),
    start,
    end,
    showPlaced,
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
