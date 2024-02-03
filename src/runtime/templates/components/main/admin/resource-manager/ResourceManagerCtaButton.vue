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
import { consola } from 'consola'
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
    consola.log('DO PUBLISH')
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

function createNewComponentPositionData (addEvent: AddResourceEvent) {
  const getPosition = () => {
    if (addEvent.closest.position) {
      return $cwa.resources.getResource(addEvent.closest.position).value
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

  const componentPosition: { componentGroup: string, sortValue: number } = {
    componentGroup: addEvent.closest.group,
    sortValue: 0
  }
  const positionResource = getPosition()
  if (positionResource) {
    const currentSortValue = positionResource.data?.sortValue
    if (currentSortValue !== undefined) {
      componentPosition.sortValue = addEvent.addAfter ? currentSortValue + 1 : currentSortValue
    }
  }
  return componentPosition
}

async function addResourceAction (publish?: boolean) {
  const addEvent = $cwa.admin.resourceStackManager.addResourceEvent.value
  if (!addEvent) {
    return
  }
  const newResource = $cwa.resources.newResource.value
  const data = newResource?.data
  if (!data?._metadata?.adding) {
    return
  }

  if (data['@type'] !== 'ComponentPosition') {
    data.componentPositions = [createNewComponentPositionData(addEvent)]
  }

  if (publish !== undefined) {
    data.publishedAt = publish ? DateTime.local().toUTC().toISO() : null
  }

  const postData: CwaResource & { '@id': undefined, '@type': undefined } = { ...data, '@id': undefined, '@type': undefined }

  await $cwa.resourcesManager.createResource({
    endpoint: data._metadata.adding.endpoint,
    data: postData
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
      addResourceAction(true)
    }
  }
}
</script>
