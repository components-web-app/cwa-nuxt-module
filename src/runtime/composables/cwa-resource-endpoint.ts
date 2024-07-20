import type { Ref } from 'vue'
import { computed, onBeforeUnmount, ref, watch, watchEffect } from 'vue'
import { getPublishedResourceState } from '#cwa/runtime/resources/resource-utils'
import { useCwa } from '#cwa/runtime/composables/cwa'

export const useCwaResourceEndpoint = (iri: Ref<string|undefined>, postfix?: string) => {
  const $cwa = useCwa()
  const resource = computed(() => iri.value ? $cwa.resources.getResource(iri.value).value : undefined)
  const forcePublishedVersion = $cwa.admin.resourceStackManager.forcePublishedVersion
  const applyPostfix = ref(false)
  const query = ref('')

  const unwatchEffect = watchEffect(() => {
    if (!resource.value) {
      applyPostfix.value = false
      return
    }
    const publishableState = getPublishedResourceState(resource.value)
    applyPostfix.value = forcePublishedVersion.value !== undefined && publishableState === true
  })

  const unwatchApplyPostfix = watch(applyPostfix, (newApplyPostfix) => {
    if (!newApplyPostfix) {
      query.value = ''
      return
    }
    query.value = forcePublishedVersion.value ? '?published=true' : '?published=false'
  }, {
    immediate: true
  })

  const endpoint = computed(() => `${iri.value}${postfix || ''}${query.value}`)

  onBeforeUnmount(() => {
    unwatchEffect()
    unwatchApplyPostfix()
  })

  return {
    endpoint,
    query
  }
}
