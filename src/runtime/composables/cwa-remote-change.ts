import { getCurrentScope, onScopeDispose, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useCwa } from '#cwa/composables/cwa'
import { useProcess } from '#cwa/composables/process'
import type { RemoteChangeHandler } from '#cwa/admin/remote-changes'

export type { RemoteChangeEvent, RemoteChangeHandler } from '#cwa/admin/remote-changes'

export const onRemoteChange = (iri: MaybeRefOrGetter<string | undefined>, handler: RemoteChangeHandler) => {
  const $cwa = useCwa()
  let stopped = false
  let unsubscribe: (() => void) | undefined

  const stopWatching = useProcess().isServer
    ? undefined
    : watch(() => $cwa.auth.isAdmin.value, async (isAdmin) => {
        if (!isAdmin || unsubscribe) {
          return
        }
        const { subscribeToRemoteChanges } = await import('#cwa/admin/remote-changes')
        if (!stopped && !unsubscribe) {
          unsubscribe = subscribeToRemoteChanges($cwa, () => toValue(iri), handler)
        }
      }, { immediate: true })

  const stop = () => {
    stopped = true
    stopWatching?.()
    unsubscribe?.()
  }
  getCurrentScope() && onScopeDispose(stop)
  return stop
}
