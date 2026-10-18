<script setup lang="ts">
import { computed, ref } from 'vue'
import DialogBox from '#cwa/templates/components/core/DialogBox.vue'
import type { ActionButton } from '#cwa/templates/components/core/DialogBox.vue'

const { total } = defineProps<{
  total: number
}>()

const emit = defineEmits<{
  confirm: [choice: 'all' | 'here']
  cancel: []
}>()

const open = ref(true)

function choose(choice: 'all' | 'here') {
  open.value = false
  emit('confirm', choice)
}

function cancel() {
  open.value = false
  setTimeout(() => emit('cancel'), 300)
}

const buttons = computed<ActionButton[]>(() => [
  {
    label: `Delete from all ${total} locations`,
    color: 'blue',
    callbackFn: () => choose('all'),
  },
  {
    label: 'Remove from this location only',
    color: 'blue',
    callbackFn: () => choose('here'),
  },
  {
    label: 'Cancel',
    color: 'grey',
    callbackFn: cancel,
  },
])
</script>

<template>
  <DialogBox
    v-model="open"
    title="Delete this component?"
    :buttons="buttons"
  >
    <p>This component is used in {{ total }} locations.</p>
  </DialogBox>
</template>
