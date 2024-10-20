import { ref } from 'vue'
import type { Ref } from 'vue'

export interface CwaMercureStateInterface {
  hub: Ref<string | null>
}

export default function (): CwaMercureStateInterface {
  return {
    hub: ref(null),
  }
}
