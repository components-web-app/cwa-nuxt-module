import { reactive } from '#imports'

export interface CwaMercureStateInterface {
  hub: string|null
}

export default function (): CwaMercureStateInterface {
  return reactive({
    hub: null
  })
}
