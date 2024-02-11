<script lang="ts" setup>
import { computed } from 'vue'
import { DateTime } from 'luxon'
import { type CwaResource } from '#cwa/runtime/resources/resource-utils'
import { useCwa } from '#cwa/runtime/composables/cwa'
import type { ButtonOption, ModelValue } from '#cwa/runtime/templates/components/ui/form/Button.vue'
import type { AddResourceEvent } from '#cwa/runtime/admin/resource-stack-manager'

const props = defineProps<{
  currentIri: string
  resource: CwaResource
}>()

const $cwa = useCwa()

const addingMeta = computed(() => props.resource?._metadata.adding)
const isPublishable = computed(() => addingMeta.value?.isPublishable)

const buttonLabel = computed<'Add Draft'|'Add'>(() => {
  return isPublishable.value ? 'Add Draft' : 'Add'
})

const buttonOptions = computed(() => {
  const ops: (ButtonOption|ButtonOption[])[] = []
  ops.push({ label: 'Discard', value: 'add-discard' })
  if (isPublishable.value) {
    ops.push({ label: 'Add and Publish', value: 'add-publish' })
  }
  return ops
})

const addEvent = computed(() => $cwa.resourcesManager.addResourceEvent.value)

const groupResource = computed(() => {
  if (!addEvent.value) {
    return
  }
  return $cwa.resources.getResource(addEvent.value.closest.group).value
})

const groupResourcePositions = computed(() => {
  if (!groupResource.value) {
    return
  }
  return groupResource.value.data?.componentPositions
})

function getDissectPositionIri () {
  if (!addEvent.value) {
    return
  }
  if (addEvent.value.closest.position) {
    return addEvent.value.closest.position
  }
  if (!groupResource.value) {
    return
  }
  if (!groupResourcePositions.value?.length) {
    return
  }
  return addEvent.value.addAfter ? groupResourcePositions.value[groupResourcePositions.value.length - 1] : groupResourcePositions.value[0]
}

function getRefreshPositions (positionIri?: string): string[] {
  const refreshPositions: string[] = []
  if (!positionIri) {
    return refreshPositions
  }
  const groupPositions = groupResourcePositions.value?.componentPositions
  if (groupPositions) {
    const currentPositions: string[]|undefined = groupPositions
    if (currentPositions) {
      const index = currentPositions.indexOf(positionIri)
      if (index !== -1) {
        const positionsAfterInsert = groupPositions.slice(index)
        if (positionsAfterInsert && positionsAfterInsert.length) {
          refreshPositions.push(...positionsAfterInsert)
        }
      }
    }
  }
  return refreshPositions
}

function createNewComponentPosition (addEvent: AddResourceEvent, positionIri?: string) {
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
  return componentPosition
}

async function addResourceAction (publish?: boolean) {
  // todo: disable button during action
  if (!addEvent.value || !addingMeta.value) {
    return
  }

  const refreshEndpoints = [addEvent.value.closest.group]

  const data = props.resource

  const positionIri = getDissectPositionIri()

  // If we are not adding a position, we will create the component with a position at the same time
  if (data['@type'] !== 'ComponentPosition') {
    data.componentPositions = [createNewComponentPosition(addEvent.value, positionIri)]
  }

  refreshEndpoints.push(...getRefreshPositions(positionIri))

  if (publish !== undefined) {
    data.publishedAt = publish ? DateTime.local().toUTC().toISO() : null
  }

  const postData: Omit<CwaResource, '@id'|'@type'> = { ...data, '@id': undefined, '@type': undefined }

  await $cwa.resourcesManager.createResource({
    endpoint: addingMeta.value.endpoint,
    data: postData,
    refreshEndpoints,
    requestCompleteFn () {
      $cwa.resourcesManager.clearAddResource()
    }
  })
}

async function handleManagerCtaClick (value?: ModelValue) {
  if (!value) {
    await addResourceAction(buttonLabel.value !== 'Add Draft')
    return
  }

  if (value === 'add-discard') {
    await $cwa.resourcesManager.confirmDiscardAddingResource()
    return
  }

  if (value === 'add-publish') {
    await addResourceAction(true)
  }
}
</script>

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
