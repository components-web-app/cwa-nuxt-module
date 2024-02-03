<template>
  <CwaUiFormButton
    color="grey"
    button-class="cwa-min-w-[100px]"
    :options="buttonOptions"
    @click="handleManagerCtaClick"
  >
    {{ buttonLabel }}
  </CwaUiFormButton>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { DateTime } from 'luxon'
import { useCwa } from '#cwa/runtime/composables/cwa'
import type { ButtonOption, ModelValue } from '#cwa/runtime/templates/components/ui/form/Button.vue'
import {
  type CwaResource,
  CwaResourceTypes,
  getPublishedResourceState,
  getResourceTypeFromIri
} from '#cwa/runtime/resources/resource-utils'
import { NEW_RESOURCE_IRI } from '#cwa/runtime/storage/stores/resources/state'
import type { AddResourceEvent } from '#cwa/runtime/admin/resource-stack-manager'

const $cwa = useCwa()
const currentIri = $cwa.admin.resourceStackManager.currentIri

const resourceType = computed(() => {
  return currentIri.value ? getResourceTypeFromIri(currentIri.value) : undefined
})

const isAddingNew = computed(() => {
  return currentIri.value === NEW_RESOURCE_IRI
})

const buttonLabel = computed<'Publish'|'Add Draft'|'Add'|undefined>(() => {
  if (!currentIri.value || (resourceType.value !== CwaResourceTypes.COMPONENT && !isAddingNew.value)) {
    return
  }
  const resource = $cwa.resources.getResource(currentIri.value).value
  if (!resource) {
    return
  }
  if (isAddingNew.value) {
    const addingMeta = resource.data?._metadata.adding
    return addingMeta?.isPublishable ? 'Add Draft' : 'Add'
  }
  const publishedState = getPublishedResourceState(resource)
  if (publishedState !== false) {
    return
  }
  return 'Publish'
})

const buttonOptions = computed(() => {
  const ops: (ButtonOption|ButtonOption[])[] = []

  if (isAddingNew.value) {
    ops.push({ label: 'Discard', value: 'add-discard' })

    const resource = $cwa.resources.getResource(NEW_RESOURCE_IRI).value
    if (!resource) {
      return ops
    }

    const addingMeta = resource.data?._metadata.adding
    if (addingMeta?.isPublishable) {
      ops.push({ label: 'Add and Publish', value: 'add-publish' })
    }
    return ops
  }

  if (resourceType.value === CwaResourceTypes.COMPONENT_POSITION || resourceType.value === CwaResourceTypes.COMPONENT) {
    ops.push([
      { label: 'Add Before', value: 'add-before' },
      { label: 'Add After', value: 'add-after' }
    ])
  } else if (resourceType.value === CwaResourceTypes.COMPONENT_GROUP) {
    ops.push([
      { label: 'Add to Start', value: 'add-before' },
      { label: 'Add to End', value: 'add-after' }
    ])
  }

  if (resourceType.value === CwaResourceTypes.COMPONENT) {
    ops.push({ label: 'Clone', value: 'clone' })
  }

  return ops
})

function handleDefaultClick () {
  if (!buttonLabel.value) {
    return
  }
  if (buttonLabel.value === 'Publish') {
    // todo: disable button during request
    publishResource()
    return
  }

  if (buttonLabel.value === 'Add') {
    addResourceAction()
    return
  }
  if (buttonLabel.value === 'Add Draft') {
    addResourceAction(false)
  }
}

async function publishResource () {
  if (!currentIri.value) {
    return
  }
  await $cwa.resourcesManager.updateResource({
    endpoint: currentIri.value,
    data: {
      publishedAt: DateTime.local().toUTC().toISO()
    }
  })
}

function getDissectPositionIri (addEvent: AddResourceEvent) {
  if (addEvent.closest.position) {
    return addEvent.closest.position
  }
  const groupResource = $cwa.resources.getResource(addEvent.closest.group).value
  if (!groupResource) {
    return
  }
  const allPositions = groupResource.data?.componentPositions
  if (!allPositions?.length) {
    return
  }
  return addEvent.addAfter ? allPositions[allPositions.length - 1] : allPositions[0]
}

function createNewComponentPositionData (addEvent: AddResourceEvent) {
  const positionIri = getDissectPositionIri(addEvent)
  const positionResource = positionIri ? $cwa.resources.getResource(positionIri).value : undefined

  const componentPosition: { componentGroup: string, sortValue: number } = {
    componentGroup: addEvent.closest.group,
    sortValue: 0
  }
  if (positionResource) {
    const currentSortValue = positionResource.data?.sortValue
    if (currentSortValue !== undefined) {
      componentPosition.sortValue = addEvent.addAfter ? currentSortValue + 1 : currentSortValue
    }
  }

  const refreshPositions: string [] = []
  const groupResource = $cwa.resources.getResource(addEvent.closest.group).value
  if (groupResource?.data?.componentPositions) {
    const currentPositions: string[]|undefined = groupResource.data.componentPositions
    if (currentPositions) {
      const index = currentPositions.indexOf(positionIri)
      if (index !== -1) {
        const positionsAfterInsert = groupResource.data.componentPositions.slice(index)
        if (positionsAfterInsert && positionsAfterInsert.length) {
          refreshPositions.push(...positionsAfterInsert)
        }
      }
    }
  }

  return {
    componentPosition,
    refreshPositions
  }
}

async function addResourceAction (publish?: boolean) {
  // todo: disable button during action

  const addEvent = $cwa.admin.resourceStackManager.addResourceEvent.value
  if (!addEvent) {
    return
  }
  const newResource = $cwa.resources.newResource.value
  const data = newResource?.data
  if (!data?._metadata?.adding) {
    return
  }

  const refreshEndpoints = [addEvent.closest.group]

  if (data['@type'] !== 'ComponentPosition') {
    const positionData = createNewComponentPositionData(addEvent)
    data.componentPositions = [positionData.componentPosition]
    refreshEndpoints.push(...positionData.refreshPositions)
  }

  if (publish !== undefined) {
    data.publishedAt = publish ? DateTime.local().toUTC().toISO() : null
  }

  const postData: Omit<CwaResource, '@id'|'@type'> = { ...data, '@id': undefined, '@type': undefined }

  await $cwa.resourcesManager.createResource({
    endpoint: data._metadata.adding.endpoint,
    data: postData,
    refreshEndpoints,
    requestCompleteFn () {
      $cwa.admin.resourceStackManager.clearAddResource()
    }
  })
}

function handleAddEvent (value: 'add-before'|'add-after') {
  if (!currentIri.value) {
    return
  }
  const addAfter = value === 'add-after'
  $cwa.admin.resourceStackManager.initAddResource(currentIri.value, addAfter)
}

async function handleManagerCtaClick (value?: ModelValue) {
  if (!value) {
    handleDefaultClick()
    return
  }

  if (typeof value === 'string') {
    if (['add-before', 'add-after'].includes(value)) {
      handleAddEvent(value as 'add-before'|'add-after')
      return
    }

    if (['add-discard'].includes(value)) {
      await $cwa.admin.resourceStackManager.confirmDiscardAddingResource()
      return
    }

    if (['add-publish'].includes(value)) {
      await addResourceAction(true)
    }
  }
}
</script>
