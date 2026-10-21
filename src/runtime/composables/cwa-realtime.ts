import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useCwa } from '#cwa/composables/cwa'
import { realtimeView } from '#cwa/resources/realtime-view'

export type { RealtimePeer } from '#cwa/admin/presence'

export const useCwaRealtime = (iri: MaybeRefOrGetter<string | undefined>) => {
  const { view } = realtimeView(useCwa())
  return {
    peers: computed(() => {
      const on = toValue(iri)
      return on && view.value ? view.value.peers(on) : []
    }),
  }
}
