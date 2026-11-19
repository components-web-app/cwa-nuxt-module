import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { CwaCurrentResourceInterface } from '#cwa/storage/stores/resources/state'
import { useCwa } from './cwa'

export const useCwaLayout = () => {
  const $cwa = useCwa()

  const layout: ComputedRef<CwaCurrentResourceInterface | undefined> = computed(() => $cwa.resources.layout.value)
  const uiClassNames = computed<string[] | undefined>(() => layout.value?.data?.uiClassNames)

  return { layout, uiClassNames }
}
