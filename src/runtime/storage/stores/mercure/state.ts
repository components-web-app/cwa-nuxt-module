import { ref } from 'vue'
import type { Ref } from 'vue'

export interface CwaMercureStateInterface {
  hub: Ref<string | null>
  connected: Ref<boolean | undefined>
}

export default function (): CwaMercureStateInterface {
  return {
    hub: ref(null),
    connected: ref(undefined),
  }
}
