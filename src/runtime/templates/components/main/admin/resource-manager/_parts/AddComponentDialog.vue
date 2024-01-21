<template>
  <DialogBox v-model="open" title="Add Component" :buttons="buttons">
    <Spinner v-if="loadingComponents" :show="true" />
    <pre v-else>{{ displayData }}</pre>
  </DialogBox>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import DialogBox, { type ActionButton } from '#cwa/runtime/templates/components/core/DialogBox.vue'
import { useCwa } from '#imports'
import { CwaResourceTypes, getResourceTypeFromIri } from '#cwa/runtime/resources/resource-utils'
import type { AddResourceEvent } from '#cwa/runtime/admin/resource-manager'
import type { ApiDocumentationComponentMetadataCollection } from '#cwa/runtime/api/api-documentation'
import Spinner from '#cwa/runtime/templates/components/utils/Spinner.vue'

const $cwa = useCwa()
const loadingComponents = ref(true)

interface DisplayDataI {
  addAfter: boolean
  targetIri: string
  availableComponents?: ApiDocumentationComponentMetadataCollection
  closestPosition?: string
  closestGroup?: string
  allowedComponents?: string[]
}

// We want as a local variable for when we close the dialog and the add event is cleared immediately - so it doesn't flicker etc.
const displayData = ref<DisplayDataI>()

const open = computed({
  get () {
    return !!$cwa.admin.resourceManager.addResourceTriggered.value
  },
  set (value: boolean) {
    if (!value) {
      $cwa.admin.resourceManager.addResourceTriggered.value = undefined
    }
  }
})

const buttons = computed<ActionButton[]>(() => {
  return [
    {
      label: 'Add',
      color: 'blue',
      buttonClass: 'cwa-min-w-[120px]',
      callbackFn: handleAdd
    },
    {
      label: 'Cancel',
      color: 'grey'
    }
  ]
})

async function findAvailableComponents (allowedComponents: undefined|string[]): Promise<undefined|ApiDocumentationComponentMetadataCollection> {
  const apiComponents = await $cwa.getComponentMetadata()
  if (!allowedComponents || !apiComponents) {
    return apiComponents
  }
  const asEntries = Object
    .entries(apiComponents)
    .filter(
      ([_, value]) => (allowedComponents.includes(value.endpoint))
    )
  return Object.fromEntries(asEntries)
}

async function createDisplayData (): Promise<undefined|DisplayDataI> {
  const event = $cwa.admin.resourceManager.addResourceTriggered.value
  if (!event) {
    return
  }

  let closestPosition: string|undefined
  if (getResourceTypeFromIri(event.targetIri) !== CwaResourceTypes.COMPONENT_GROUP) {
    closestPosition = findClosesResourceByType(CwaResourceTypes.COMPONENT_POSITION)
  } else {
    closestPosition = findPositionFromGroupEvent(event)
  }

  const closestGroup = findClosesResourceByType(CwaResourceTypes.COMPONENT_GROUP)
  const allowedComponents = closestGroup ? findAllowedComponents(closestGroup) : undefined

  return {
    addAfter: event.addAfter,
    targetIri: event.targetIri,
    availableComponents: await findAvailableComponents(allowedComponents),
    closestPosition,
    closestGroup,
    allowedComponents
  }
}

function handleAdd () {
  open.value = false
}

function findAllowedComponents (groupIri: string): undefined|string[] {
  return $cwa.resources.getResource(groupIri).value?.data?.allowedComponents
}

function findPositionFromGroupEvent (event: AddResourceEvent) {
  const positions = $cwa.resources.getResource(event.targetIri).value?.data?.componentPositions
  if (!positions || !positions.length) {
    return
  }
  if (event.addAfter) {
    return positions[positions.length - 1]
  } else {
    return positions[0]
  }
}

function findClosesResourceByType (type: CwaResourceTypes): string|undefined {
  const stack = $cwa.admin.resourceManager.resourceStack.value
  for (const stackItem of stack) {
    if (getResourceTypeFromIri(stackItem.iri) === type) {
      return stackItem.iri
    }
  }
}

// We do not want the modal content to disappear as soon as the add event is gone, so we populate and cache the data which determines the display
watch(open, async (isOpen: boolean) => {
  if (!isOpen) {
    return
  }
  displayData.value = await createDisplayData()
  loadingComponents.value = false
})
</script>
