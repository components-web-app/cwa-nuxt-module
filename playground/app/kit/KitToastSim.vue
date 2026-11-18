<script setup lang="ts">
import { ref } from 'vue'
import { useCwaToast } from '#imports'
import { CwaUiButton } from '#components'
import KitSim from './KitSim.vue'
import KitDemo from './KitDemo.vue'
import type { CwaToastOptions } from '../../../src/runtime/composables/cwa-toast'

const toast = useCwaToast()
const raised = ref<string[]>([])
let count = 0

const kinds: { key: string, label: string, options: () => CwaToastOptions }[] = [
  { key: 'success', label: 'Success', options: () => ({ tone: 'success', title: 'Published', description: 'Hero section on Kitchens.' }) },
  { key: 'info', label: 'Info', options: () => ({ tone: 'info', title: 'Updated from your other window', description: 'Title and Intro on Hero section.' }) },
  { key: 'warning', label: 'Warning', options: () => ({ tone: 'warning', title: 'Mercure reconnected', description: '3 components on this page changed while you were away.' }) },
  { key: 'error', label: 'Error with actions', options: () => ({ id: `kit-sim-error-${++count}`, tone: 'error', title: 'Title wasn’t saved', description: 'You switched tabs before it could save.', actions: [{ label: 'Show me', primary: true, onClick: () => {} }, { label: 'Retry', onClick: () => {} }, { label: 'Reset', onClick: () => {} }] }) },
  { key: 'errors', label: 'Several errors', options: () => ({ id: `kit-sim-errors-${++count}`, tone: 'error', title: '2 changes weren’t saved', description: 'Title and Subtitle, on Hero section. Reset puts back their last saved values.', actions: [{ label: 'Show me', primary: true, onClick: () => {} }, { label: 'Retry all', onClick: () => {} }, { label: 'Reset all', onClick: () => {} }] }) },
]

function raise(kind: typeof kinds[number]) {
  toast.show(kind.options())
  raised.value = [...raised.value, kind.label].slice(-6)
}

function stack() {
  kinds.forEach(raise)
}

function same() {
  const options = { id: 'kit-sim-same', tone: 'warning', title: 'Raised twice', description: 'Raising the same toast again changes nothing.' } satisfies CwaToastOptions
  toast.show(options)
  toast.show(options)
  raised.value = [...raised.value, 'The same toast twice'].slice(-6)
}
</script>

<template>
  <KitSim
    id="kit-sim-toasts"
    title="Simulation: toasts"
    intro="Raised through useCwaToast(), the real toaster. At most 3 show, the oldest on top; the rest wait behind “+N more”, beside Dismiss all. Raise all five at once to see the queue."
  >
    <template #controls>
      <CwaUiButton
        v-for="kind in kinds"
        :key="kind.key"
        :label="kind.label"
        size="sm"
        :data-testid="`kit-sim-toasts-${kind.key}`"
        @click="raise(kind)"
      />
      <CwaUiButton
        label="Stack all five"
        size="sm"
        variant="solid"
        data-testid="kit-sim-toasts-stack"
        @click="stack"
      />
      <CwaUiButton
        label="The same toast twice"
        size="sm"
        @click="same"
      />
    </template>
    <KitDemo
      component="Toaster"
      :state="raised.length ? `raised: ${raised.join(', ')}` : 'nothing raised yet'"
      wide
    >
      <span />
    </KitDemo>
  </KitSim>
</template>
