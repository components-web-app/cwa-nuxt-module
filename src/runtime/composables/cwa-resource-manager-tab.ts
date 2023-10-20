import { computed } from 'vue'
import { useCwa } from '#cwa/runtime/composables/cwa'

export interface CwaResourceManagerTabOptions {
  name: string,
  order?: number
}

export const useCwaResourceManagerTab = (options?: CwaResourceManagerTabOptions) => {
  const $cwa = useCwa()
  const iri = $cwa.admin.componentManager.currentIri
  const resource = computed(() => iri.value ? $cwa.resources.getResource(iri.value).value : undefined)
  return {
    $cwa,
    iri,
    resource,
    exposeMeta: options
  }
}
