<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
let answered = false

function choose(choice: 'all' | 'here') {
  answered = true
  open.value = false
  emit('confirm', choice)
}

function cancel() {
  answered = true
  open.value = false
  setTimeout(() => emit('cancel'), 300)
}

watch(open, (isOpen) => {
  !isOpen && !answered && cancel()
})

const buttons = computed<ActionButton[]>(() => [
  {
    label: 'Remove from this location only',
    color: 'blue',
    callbackFn: () => choose('here'),
  },
  {
    label: `Delete from all ${total} locations`,
    color: 'error',
    callbackFn: () => choose('all'),
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
