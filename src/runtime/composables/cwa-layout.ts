import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { CwaCurrentResourceInterface } from '#cwa/storage/stores/resources/state'
import { useCwa } from './cwa'
import { useCwaAutoClass } from './cwa-auto-class'

export interface CwaLayoutOps {
  autoClass?: boolean
}

export const useCwaLayout = (opts?: CwaLayoutOps) => {
  const $cwa = useCwa()

  const layout: ComputedRef<CwaCurrentResourceInterface | undefined> = computed(() => $cwa.resources.layout.value)
  const uiClassNames = computed<string[] | undefined>(() => layout.value?.data?.uiClassNames)

  useCwaAutoClass(uiClassNames, opts)

  return { layout, uiClassNames }
}
