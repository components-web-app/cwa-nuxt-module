<script setup lang="ts">
import { computed, ref } from 'vue'
import DialogBox, { type ActionButton } from '#cwa/runtime/templates/components/core/DialogBox.vue'

const props = withDefaults(defineProps<{
  title: string
  content: string
}>(), {
  title: 'No Title Set',
  content: 'No Content Set',
})

const emit = defineEmits(['confirm', 'cancel'])
const open = ref(true)

function completeDialog(eventName: 'confirm' | 'cancel') {
  open.value = false
  setTimeout(() => {
    emit(eventName)
  }, eventName === 'cancel' ? 300 : 0)
}

const buttons = computed<ActionButton[]>(() => {
  return [
    {
      label: 'Ok',
      color: 'blue',
      buttonClass: 'cwa-min-w-[120px]',
      callbackFn: () => (completeDialog('confirm')),
    },
    {
      label: 'Cancel',
      color: 'grey',
      callbackFn: () => (completeDialog('cancel')),
    },
  ]
})
</script>

<template>
  <DialogBox
    v-model="open"
    :title="title"
    :buttons="buttons"
  >
    <div v-html="props.content" />
  </DialogBox>
</template>
