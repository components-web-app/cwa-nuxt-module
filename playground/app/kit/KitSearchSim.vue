<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import { CwaUiButton, CwaUiMultiSelect, CwaUiResourceSearch, CwaUiSegmented, CwaUiSelect } from '#components'
import KitSim from './KitSim.vue'
import KitDemo from './KitDemo.vue'
import KitSlot from './KitSlot.vue'
import KitLoadControls from './KitLoadControls.vue'
import { kitLoader } from './fake-loader'
import { kitSearchLabel, kitSearchSource, kitSelectOptions, kitStyleOptions } from './kit-data'
import type { KitSearchOutcome } from './kit-data'
import { typeInto, typeableIn } from './type-into'

const outcome = ref<KitSearchOutcome>('results')
const outcomeOptions = [{ value: 'results', label: 'Results' }, { value: 'empty', label: 'Empty' }, { value: 'error', label: 'Error' }]
const terms = ['gal', 'galery', 'map', 'text']
const search = kitSearchSource(kitLoader, () => outcome.value)
const chosen = ref<string | null>(null)
const layout = ref<string | null>('split')
const styles = ref<string[]>(['padding'])
const searchDemo = useTemplateRef<HTMLElement>('searchDemo')
const typed = ref('')

async function typeTerm(term: string) {
  const input = typeableIn(searchDemo.value)
  if (input) {
    typed.value = term
    await typeInto(input, term, { delay: 90 })
  }
}
</script>

<template>
  <KitSim
    id="kit-sim-search"
    title="Simulation: search menus"
    intro="The search menu loads through the shared loading control. Type-for-me types into it one key at a time, as a person would, so debounce, stale answers and the slow message all run for real. Results, Empty and Error choose how the fake answers."
  >
    <template #controls>
      <CwaUiButton
        v-for="term in terms"
        :key="term"
        :label="`Type ‘${term}’`"
        size="sm"
        :data-testid="`kit-sim-search-type-${term}`"
        @click="typeTerm(term)"
      />
      <CwaUiSegmented
        v-model="outcome"
        label="Answer"
        :options="outcomeOptions"
        data-testid="kit-sim-search-outcome"
      />
      <KitLoadControls />
    </template>
    <KitDemo
      component="CwaUiResourceSearch"
      :state="`${outcome}, ${kitLoader.state.mode} loading${typed ? `, typed ‘${typed}’` : ''}`"
    >
      <div ref="searchDemo">
        <CwaUiResourceSearch
          v-model="chosen"
          label="Component"
          endpoint="/component"
          noun="components"
          :label-of="kitSearchLabel"
          :load="search.load"
          :resolve="search.resolve"
          placeholder="Search components"
          data-testid="kit-sim-search-field"
        />
      </div>
    </KitDemo>
    <KitDemo
      component="CwaUiSelect"
      state="a disabled option with its reason, and a group"
    >
      <CwaUiSelect
        v-model="layout"
        label="Layout"
        :options="kitSelectOptions"
      />
    </KitDemo>
    <KitDemo
      component="CwaUiMultiSelect"
      state="type to filter"
    >
      <CwaUiMultiSelect
        v-model="styles"
        label="Styles"
        :options="kitStyleOptions"
      />
    </KitDemo>
    <KitSlot
      name="the type select"
      from="7b or 7d"
    />
  </KitSim>
</template>
