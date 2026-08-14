import { ref } from 'vue'
import type { Ref } from 'vue'

export interface CwaMercureStateInterface {
  hub: Ref<string | null>
  // Whether the EventSource is currently connected. `undefined` until the first connection opens,
  // which is what distinguishes an initial connect (nothing missed) from a reconnect (revalidate).
  connected: Ref<boolean | undefined>
}

export default function (): CwaMercureStateInterface {
  return {
    hub: ref(null),
    connected: ref(undefined),
  }
}
