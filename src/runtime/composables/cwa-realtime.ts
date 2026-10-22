import { computed, getCurrentScope, onScopeDispose, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useCwa } from '#cwa/composables/cwa'
import { realtimeView } from '#cwa/resources/realtime-view'
import type { RealtimeEventHandler } from '#cwa/admin/presence'

export type { RealtimePeer, RealtimeEventHandler, RealtimeEventMeta } from '#cwa/admin/presence'

export type RealtimeEvents = Record<string, unknown>

function reserved(event: string) {
  if (event !== 'presence' && !event.startsWith('cwa:')) {
    return false
  }
  if (import.meta.env.DEV) {
    throw new Error(`"${event}" is reserved for CWA's own real-time events: give your event another name.`)
  }
  return true
}

export const useCwaRealtime = <Events extends object = RealtimeEvents>(iri: MaybeRefOrGetter<string | undefined>) => {
  const { view } = realtimeView(useCwa())
  return {
    peers: computed(() => {
      const on = toValue(iri)
      return on && view.value ? view.value.peers(on) : []
    }),
    send: <Event extends keyof Events & string>(event: Event, data: Events[Event]) => {
      const on = toValue(iri)
      if (!reserved(event) && on) {
        view.value?.send(on, event, data)
      }
    },
    on: <Event extends keyof Events & string>(event: Event, handler: RealtimeEventHandler<Events[Event]>) => {
      if (reserved(event)) {
        return () => {}
      }
      let off: (() => void) | undefined
      const stopWatching = watch(view, (loaded) => {
        if (loaded && !off) {
          off = loaded.on(() => toValue(iri), event, handler as RealtimeEventHandler)
        }
      }, { immediate: true })
      const stop = () => {
        stopWatching()
        off?.()
        off = undefined
      }
      getCurrentScope() && onScopeDispose(stop)
      return stop
    },
  }
}
