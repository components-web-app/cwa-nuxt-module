<script setup lang="ts">
import { computed } from 'vue'
import { CwaUiButton, CwaUiSegmented } from '#components'
import { kitLoadModes, kitLoader } from './fake-loader'
import type { KitLoadMode } from './fake-loader'

const mode = computed({
  get: () => kitLoader.state.mode,
  set: (value) => {
    kitLoader.setMode((value ?? 'normal') as KitLoadMode)
  },
})
</script>

<template>
  <CwaUiSegmented
    v-model="mode"
    label="Loading"
    info="Shared by the lists, search menus and dialogs on this page. Load once makes only the next load slow; Held keeps every load waiting until you release it."
    :options="kitLoadModes"
    data-testid="kit-load-mode"
  />
  <CwaUiButton
    v-if="kitLoader.state.mode === 'held'"
    :label="`Release ${kitLoader.state.holding} held`"
    size="sm"
    :disabled="!kitLoader.state.holding"
    disabled-reason="Nothing is waiting"
    data-testid="kit-load-release"
    @click="kitLoader.release()"
  />
</template>
