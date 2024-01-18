<template>
  <DialogBox v-model="open" title="Add Component" :buttons="buttons">
    <pre>{{ availableComponents }}</pre>
  </DialogBox>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import DialogBox, { type ActionButton } from '#cwa/runtime/templates/components/core/DialogBox.vue'
import { useCwa } from '#imports'

const $cwa = useCwa()

const availableComponents = ref()

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

function populateAvailableComponents () {
  availableComponents.value = $cwa.admin.resourceManager.addResourceTriggered.value?.targetIri
}

function handleAdd () {
  open.value = false
}

watch(open, (isOpen) => {
  if (!isOpen) {
    return
  }
  populateAvailableComponents()
})
</script>
