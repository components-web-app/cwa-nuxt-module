import type { Ref } from 'vue'
import { computed } from 'vue'
import { getPublishedResourceState } from '#cwa/resources/resource-utils'
import { useCwa } from '#cwa/composables/cwa'

export const useCwaResourceEndpoint = (iri: Ref<string | undefined>, postfix?: string) => {
  const $cwa = useCwa()
  const resource = computed(() => iri.value ? $cwa.resources.getResource(iri.value).value : undefined)
  const forcePublishedVersion = $cwa.admin.resourceStackManager.forcePublishedVersion

  const applyPostfix = computed(() => {
    if (!resource.value) {
      return false
    }
    return (forcePublishedVersion.value !== undefined || !$cwa.admin.isEditing) && getPublishedResourceState(resource.value) === true
  })

  const query = computed(() => {
    if (!applyPostfix.value) {
      return ''
    }
    return (forcePublishedVersion.value || !$cwa.admin.isEditing) ? '?published=true' : '?published=false'
  })

  const endpoint = computed(() => `${iri.value}${postfix || ''}${query.value}`)

  return {
    endpoint,
    query,
  }
}
