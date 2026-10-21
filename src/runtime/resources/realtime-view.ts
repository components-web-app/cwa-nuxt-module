import { effectScope, shallowRef, watch } from 'vue'
import type { ShallowRef } from 'vue'
import type Cwa from '#cwa/cwa'
import type { usePresence } from '#cwa/admin/presence'
import { useProcess } from '#cwa/composables/process'

export type RealtimeView = ReturnType<typeof usePresence>

interface RealtimeLoader {
  view: ShallowRef<RealtimeView | undefined>
  load: () => Promise<RealtimeView | undefined>
}

const loaders = new WeakMap<Cwa, RealtimeLoader>()

export function realtimeView($cwa: Cwa): RealtimeLoader {
  const existing = loaders.get($cwa)
  if (existing) {
    return existing
  }
  const view = shallowRef<RealtimeView>()
  let loading: Promise<RealtimeView | undefined> | undefined
  const load = () => {
    if (!loading && $cwa.realtimeConfig?.enabled !== false && $cwa.auth.isAdmin.value) {
      loading = import('#cwa/admin/presence').then(({ usePresence }) => (view.value = usePresence($cwa)))
    }
    return loading ?? Promise.resolve(undefined)
  }
  const loader = { view, load }
  loaders.set($cwa, loader)
  if (!useProcess().isServer) {
    effectScope(true).run(() => watch(() => $cwa.auth.isAdmin.value, load, { immediate: true }))
  }
  return loader
}
