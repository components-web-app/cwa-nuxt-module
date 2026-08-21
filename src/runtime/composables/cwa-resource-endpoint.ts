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

  // Derived, never assigned. This used to be a ref written by a watcher on `applyPostfix`, so it
  // only changed when `applyPostfix` did: toggling the Publish tab from live back to draft leaves
  // `applyPostfix` true (the resource is still publishable), so the query stayed `?published=true`
  // and the next write was sent to the version the user was not looking at. Deriving it also makes
  // it synchronous, so a request fired in the same tick as the toggle uses the new value.
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
