<template>
  <DialogBox v-model="open" title="Add Component" :buttons="buttons">
    <pre>{{ displayData }}</pre>
  </DialogBox>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import DialogBox, { type ActionButton } from '#cwa/runtime/templates/components/core/DialogBox.vue'
import { useCwa } from '#imports'

const $cwa = useCwa()

interface DisplayDataI {
  addAfter: boolean
  targetIri: string
  availableResources: string[]
}

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

function findAvailableResources (targetIri: string) {
  return [targetIri]
}

function populateAvailableResources () {
  const event = $cwa.admin.resourceManager.addResourceTriggered.value
  if (!event) {
    return
  }

  displayData.value = {
    addAfter: event.addAfter,
    targetIri: event.targetIri,
    availableResources: findAvailableResources(event.targetIri)
  }
}

function handleAdd () {
  open.value = false
}

// We do not want the modal content to disappear as soon as the add event is gone, so we populate and cache the data which determines the display
watch(open, (isOpen) => {
  if (!isOpen) {
    return
  }
  populateAvailableResources()
})
</script>
