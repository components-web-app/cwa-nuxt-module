import { effectScope, shallowReadonly, shallowRef, watch } from 'vue'
import type { EffectScope, Ref } from 'vue'
import type Cwa from '#cwa/cwa'

export interface CloneSource {
  iri: string
  name?: string
}

export interface CloneMode {
  source: Readonly<Ref<CloneSource | undefined>>
  start: (iri: string, name?: string) => void
  end: () => void
}

const cloneModes = new WeakMap<Cwa, CloneMode>()

function isDialogOpen() {
  return !!document.querySelector('[role="dialog"], [aria-modal="true"]')
}

function createCloneMode($cwa: Cwa): CloneMode {
  const source = shallowRef<CloneSource | undefined>()
  let scope: EffectScope | undefined

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || event.defaultPrevented || isDialogOpen()) {
      return
    }
    end()
  }

  function stopListening() {
    scope?.stop()
    scope = undefined
    window.removeEventListener('keydown', onKeydown)
  }

  function start(iri: string, name?: string) {
    stopListening()
    source.value = { iri, name }
    scope = effectScope(true)
    scope.run(() => {
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
