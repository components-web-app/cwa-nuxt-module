import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import type { ComputedRef } from 'vue'
import { CwaResourceTypes } from '#cwa/resources/resource-utils'
import type Cwa from '#cwa/cwa'

export const useComponentGroupPositions = (iri: ComputedRef<string | undefined>, $cwa: Cwa) => {
  const groupIsReordering = computed(() => {
    if (!iri.value || !$cwa.admin.resourceStackManager.getState('reordering')) {
      return false
    }
    // look for the earliest component group and if this is the deepest nested one, we enable reordering
    return $cwa.admin.resourceStackManager.getClosestStackItemByType(CwaResourceTypes.COMPONENT_GROUP) === iri.value
  })

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
    groupIsReordering,
    componentPositions,
  }
}
