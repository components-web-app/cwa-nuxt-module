<template>
  <DialogBox v-model="open" title="Add Component" :buttons="buttons">
    <p>Content Here</p>
  </DialogBox>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import DialogBox, { type ActionButton } from '#cwa/runtime/templates/components/core/DialogBox.vue'

const open = ref(true)

function handleAdd () {
  console.log('handleAdd')
  open.value = false
}

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
</script>
