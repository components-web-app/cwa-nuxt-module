import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import type { ComputedRef } from 'vue'
import type Cwa from '#cwa/cwa'

export const useComponentGroupPositions = (iri: ComputedRef<string | undefined>, $cwa: Cwa) => {
  const componentPositions = computed(() => {
    return iri.value ? $cwa.resources.getOrderedPositionsForGroup(iri.value) : undefined
  })

  let mounted = false
  let acquiredIri: string | undefined

  function syncRegistration(nextIri: string | undefined) {
    const wantedIri = mounted ? nextIri : undefined
    if (wantedIri === acquiredIri) {
      return
    }
    if (acquiredIri) {
      $cwa.componentGroupReorders.release(acquiredIri)
    }
    acquiredIri = wantedIri
    if (acquiredIri) {
      $cwa.componentGroupReorders.acquire(acquiredIri)
    }
  }

  watch(iri, syncRegistration)

  onMounted(() => {
    mounted = true
    syncRegistration(iri.value)
  })

  onBeforeUnmount(() => {
    mounted = false
    syncRegistration(undefined)
  })

  return {
    componentPositions,
  }
}
