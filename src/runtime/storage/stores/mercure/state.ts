import { Ref } from 'vue'
import { ref } from '#imports'

export interface CwaMercureStateInterface {
  hub: Ref<string|null>
}

export default function (): CwaMercureStateInterface {
  return {
    hub: ref(null)
  }
}
