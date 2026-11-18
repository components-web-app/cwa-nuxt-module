<script setup lang="ts">
import { ref, watch } from 'vue'
import { CwaUiSegmented } from '#components'
import KitSim from './KitSim.vue'
import KitFieldPlace from './KitFieldPlace.vue'
import { createFakeSaveServer } from './fake-save-server'
import { kitFieldKeys, kitFieldSet, kitTheirs } from './kit-field-set'
import type { KitPlace } from './kit-field-set'

type ForcedState = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict' | 'disabled'

const stateOptions: { value: ForcedState, label: string }[] = [
  { value: 'idle', label: 'Idle' },
  { value: 'pending', label: 'Pending' },
  { value: 'saving', label: 'Saving' },
  { value: 'saved', label: 'Saved' },
  { value: 'error', label: 'Error' },
  { value: 'conflict', label: 'Conflict' },
  { value: 'disabled', label: 'Disabled' },
]
const placeOptions = [{ value: 'page', label: 'Page' }, { value: 'bar', label: 'Manager row' }, { value: 'dialog', label: 'Dialog' }]

const server = createFakeSaveServer()
const set = kitFieldSet(server)
const state = ref<ForcedState>('idle')
const place = ref<KitPlace>('page')

watch(state, (value) => {
  for (const key of kitFieldKeys) {
    set[key].force(value, kitTheirs[key] as never)
  }
})
</script>

<template>
  <KitSim
    id="kit-sim-field-states"
    title="Simulation: field states"
    intro="Every field type side by side in one save state, set through the same field-state functions the store uses. Error offers Retry and Reset on focus or hover; Conflict offers Keep mine and Use theirs. Typing afterwards saves through the fake adapter, so a state moves on as it would."
  >
    <template #controls>
      <CwaUiSegmented
        v-model="state"
        label="State"
        :options="stateOptions"
        data-testid="kit-sim-field-states-state"
      />
      <CwaUiSegmented
        v-model="place"
        label="In"
        :options="placeOptions"
        data-testid="kit-sim-field-states-place"
      />
    </template>
    <KitFieldPlace
      :set="set"
      :place="place"
      :state="state"
      :disabled="state === 'disabled'"
      disabled-reason="Publish the page first"
      test-id="kit-sim-field-states-fields"
      @close-dialog="place = 'page'"
    />
  </KitSim>
</template>
