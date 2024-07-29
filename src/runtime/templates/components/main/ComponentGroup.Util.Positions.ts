import { computed, type ComputedRef, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { debounce } from 'lodash-es'
import { CwaResourceTypes } from '#cwa/runtime/resources/resource-utils'
import type Cwa from '#cwa/runtime/cwa'
import type { ReorderEvent } from '#cwa/runtime/admin/admin'

const moveElement = (array: string[], fromIndex: number, toIndex: number) => {
  const startIndex = fromIndex < 0 ? array.length + fromIndex : fromIndex

  if (startIndex >= 0 && startIndex < array.length) {
    const endIndex = toIndex < 0 ? array.length + toIndex : toIndex

    const [item] = array.splice(fromIndex, 1)
    array.splice(endIndex, 0, item)
  }
}

export const useComponentGroupPositions = (iri: ComputedRef<string|undefined>, $cwa: Cwa) => {
  const updateRequests: Ref<{ [iri: string]: { debounced?: any, apiRequest?: any } }> = ref({})

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

  let oldPositions: string[]|undefined
  function handleReorderEvent (event: ReorderEvent) {
    if (!groupIsReordering.value || !componentPositions.value) {
      return
    }

    const currentIndex = componentPositions.value.indexOf(event.positionIri)
    if (currentIndex === -1) {
      return
    }

    if (!oldPositions) {
      oldPositions = [...componentPositions.value]
    }

    let newIndex: number
    switch (event.location) {
      case 'next':
        newIndex = currentIndex + 1
        break

      case 'previous':
        newIndex = currentIndex - 1
        break

      default:
        newIndex = event.location - 1
        break
    }
    if (newIndex < 0) {
      newIndex = 0
    }

    const positionCopy = [...componentPositions.value]
    moveElement(positionCopy, currentIndex, newIndex)
    for (const [index, iri] of positionCopy.entries()) {
      const currentResource = $cwa.resources.getResource(iri).value?.data
      if (!currentResource) {
        continue
      }
      currentResource._metadata.sortDisplayNumber = index + 1
      $cwa.resourcesManager.saveResource({
        resource: currentResource
      })
    }
    $cwa.admin.eventBus.emit('redrawFocus', undefined)

    if (updateRequests.value[event.positionIri] === undefined) {
      updateRequests.value[event.positionIri] = {}
    }
    if (updateRequests.value[event.positionIri].debounced) {
      updateRequests.value[event.positionIri].debounced.cancel()
    }
    updateRequests.value[event.positionIri].debounced = debounce(async () => {
      if (!oldPositions) {
        return
      }
      const savedPositions = oldPositions
      oldPositions = undefined
      if (updateRequests.value[event.positionIri].apiRequest) {
        await updateRequests.value[event.positionIri].apiRequest
      }
      componentPositions.value && sendUpdatePositionRequest(event.positionIri, componentPositions.value, savedPositions)
    }, 1000)
    updateRequests.value[event.positionIri].debounced()
  }

  function sendUpdatePositionRequest (iri: string, newPositions: string[], oldPositions: string[]) {
    if (!updateRequests.value[iri]) {
      return
    }
    // wait for previous request to finish before calculating and submitting new request
    // a request queue system is preferable

    // component position order has changed in the UI, we want to start synchronising this with the API
    // multiple changes can happen in quick succession, so we want to debounce any update
    // the process for the API is we just need to update the sortValue of the position that has moved
    // we should set the new sort value to the sort value of the position that was in that place before
    // other positions order will be automatically recalculated and saved many API requests
    const oldIndex = oldPositions.indexOf(iri)
    const newIndex = newPositions.indexOf(iri)
    if (oldIndex === newIndex) {
      return
    }
    const positionToOverwrite = oldPositions[newIndex]
    if (!positionToOverwrite) {
      return
    }
    const positionToOverwriteSortValue = $cwa.resources.getResource(positionToOverwrite).value?.data?.sortValue
    if (positionToOverwriteSortValue === undefined) {
      return
    }

    updateRequests.value[iri].apiRequest = new Promise<void>((resolve) => {
      updateRequests.value[iri].apiRequest = $cwa.resourcesManager.updateResource({
        endpoint: iri,
        data: {
          sortValue: positionToOverwriteSortValue
        }
      })
      updateRequests.value[iri].apiRequest.then(() => {
        updateRelatedLocalSortValues(iri, newIndex, oldIndex, oldPositions)
        resolve()
      })
    })
  }

  function updateRelatedLocalSortValues (iri: string, newIndex: number, oldIndex: number, oldPositions: string[]) {
    // we need to emulate what the position values would do on the server to update the other sortValues in data
    // without performing lots of requests to fetch all the new values
    // we will also reset all the metadata display sort numbers

    const updatePosSortValue = (positionIri: string, moveBy: number) => {
      const posRes = $cwa.resources.getResource(positionIri).value?.data
      if (posRes === undefined || posRes.sortValue === undefined) {
        return
      }
      const sortValue = posRes.sortValue + moveBy
      $cwa.resourcesManager.saveResource({
        resource: {
          ...posRes,
          sortValue,
          _metadata: {
            ...posRes._metadata,
            sortDisplayNumber: undefined
          }
        }
      })
    }

    if (newIndex > oldIndex) {
      for (const [index, positionIri] of oldPositions.entries()) {
        if (positionIri === iri) {
          continue
        }
        if (index > oldIndex && index <= newIndex) {
          updatePosSortValue(positionIri, -1)
        } else {
          // to clear the sortDisplayNumber even if the sortValue is not updated, so we order again based on sortValue
          updatePosSortValue(positionIri, 0)
        }
      }
    } else {
      for (const [index, positionIri] of oldPositions.entries()) {
        if (positionIri === iri) {
          continue
        }
        if (index < oldIndex && index >= newIndex) {
          updatePosSortValue(positionIri, 1)
        } else {
          // to clear the sortDisplayNumber even if the sortValue is not updated, so we order again based on sortValue
          updatePosSortValue(positionIri, 0)
        }
      }
    }
  }

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
