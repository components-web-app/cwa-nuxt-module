import { computed, type ComputedRef, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { CwaResourceTypes } from '#cwa/runtime/resources/resource-utils'
import type Cwa from '#cwa/runtime/cwa'
import type { ReorderEvent } from '#cwa/runtime/admin/admin'

type PositionSortValues = {
  [iri: string]: {
    storeValue: number|undefined
    submittingValue?: number
  }
}

const moveElement = (array: string[], fromIndex: number, toIndex: number) => {
  const startIndex = fromIndex < 0 ? array.length + fromIndex : fromIndex

  if (startIndex >= 0 && startIndex < array.length) {
    const endIndex = toIndex < 0 ? array.length + toIndex : toIndex

    const [item] = array.splice(fromIndex, 1)
    array.splice(endIndex, 0, item)
  }
}

export const useComponentGroupPositions = (iri: ComputedRef<string|undefined>, $cwa: Cwa) => {
  const positionSortValues: Ref<PositionSortValues> = ref({})

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

  function handleReorderEvent (event: ReorderEvent) {
    if (!groupIsReordering.value || !componentPositions.value) {
      return
    }

    const currentIndex = componentPositions.value.indexOf(event.positionIri)
    if (currentIndex === -1) {
      return
    }

    let newIndex: number = 0
    switch (event.location) {
      case 'next':
        newIndex = currentIndex + 1
        break

      case 'previous':
        newIndex = currentIndex - 1
        if (newIndex < 0) {
          newIndex = 0
        }
        break

      default:
        newIndex = event.location
        break
    }

    const positionCopy = [...componentPositions.value]
    moveElement(positionCopy, currentIndex, newIndex)
    for (const [index, iri] of positionCopy.entries()) {
      submitSortValueUpdate(event.positionIri, iri, index)
    }
    $cwa.admin.eventBus.emit('redrawFocus', undefined)
  }

  async function submitSortValueUpdate (eventIri: string, iri: string, newValue: number) {
    const sortValues = positionSortValues.value[iri]
    if (!sortValues) {
      return
    }

    const checkValue = sortValues.submittingValue !== undefined ? sortValues.submittingValue : sortValues.storeValue
    if (newValue === checkValue) {
      return
    }

    if (eventIri !== iri) {
      const currentResource = $cwa.resources.getResource(iri).value?.data
      if (currentResource) {
        $cwa.resourcesManager.saveResource({
          resource: {
            ...currentResource,
            sortValue: newValue
          }
        })
      }
      return
    }
    sortValues.submittingValue = newValue
    await $cwa.resourcesManager.updateResource({
      endpoint: iri,
      data: {
        sortValue: newValue
      }
    })
    positionSortValues.value[iri].submittingValue = undefined
  }

  // watchEffect(() => {
  //   // when position iris change from the resource we update positionSortValues and retain last submitting value too
  //   // can this not be a computed reference? Moved away from computed, why?.. hmm..
  //   const newValues: PositionSortValues = {}
  //   if (!positionIris.value) {
  //     return
  //   }
  //   for (const iri of positionIris.value) {
  //     newValues[iri] = {
  //       storeValue: $cwa.resources.getResource(iri).value?.data?.sortValue || 0,
  //       submittingValue: positionSortValues.value[iri]?.submittingValue
  //     }
  //   }
  //   positionSortValues.value = newValues
  // })

  onMounted(() => {
    $cwa.admin.eventBus.on('reorder', handleReorderEvent)
  })

  onBeforeUnmount(() => {
    $cwa.admin.eventBus.off('reorder', handleReorderEvent)
  })

  return {
    groupIsReordering,
    componentPositions
  }
}
