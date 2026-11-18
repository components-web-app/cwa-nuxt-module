<script setup lang="ts">
import { computed, ref } from 'vue'
import { CwaUiButton, CwaUiSegmented } from '#components'
import ResourceStack from '../../../src/runtime/templates/components/core/ui/ResourceStack.vue'
import KitSim from './KitSim.vue'
import KitDemo from './KitDemo.vue'

type Depth = 'shallow' | 'deep' | 'more'
type Spot = 'centre' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'left' | 'right'

const names = ['Rich text', 'Component position', 'Left column group', 'Two columns', 'Component position', 'Tab panel group', 'Tabs', 'Component position', 'Main content group']
const depthOptions = [{ value: 'shallow', label: 'Shallow (3)' }, { value: 'deep', label: 'Deep (9)' }, { value: 'more', label: 'With Show more' }]
const spotOptions: { value: Spot, label: string }[] = [
  { value: 'centre', label: 'Centre' },
  { value: 'top-left', label: 'Top left' },
  { value: 'top-right', label: 'Top right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-right', label: 'Bottom right' },
  { value: 'left', label: 'Left edge' },
  { value: 'right', label: 'Right edge' },
]

const depth = ref<Depth>('deep')
const at = ref<HTMLElement | { x: number, y: number }>()
const openedBy = ref('')
const key = ref(0)
const keyboard = ref(false)
const chosen = ref('')

const levels = computed(() => names.slice(0, depth.value === 'shallow' ? 3 : 9).map((label, index) => ({ key: String(index), label })))
const limit = computed(() => depth.value === 'deep' ? 9 : 5)

function pointFor(spot: Spot) {
  const width = window.innerWidth
  const height = window.innerHeight
  const inset = 12
  return {
    'centre': { x: width / 2, y: height / 2 },
    'top-left': { x: inset, y: inset },
    'top-right': { x: width - inset, y: inset },
    'bottom-left': { x: inset, y: height - inset },
    'bottom-right': { x: width - inset, y: height - inset },
    'left': { x: inset, y: height / 2 },
    'right': { x: width - inset, y: height / 2 },
  }[spot]
}

function openAt(spot: Spot) {
  key.value++
  keyboard.value = false
  at.value = pointFor(spot)
  openedBy.value = `opened at the ${spotOptions.find(option => option.value === spot)!.label.toLowerCase()}`
}

function openOver(event: MouseEvent) {
  key.value++
  keyboard.value = event.detail === 0
  at.value = event.currentTarget as HTMLElement
  openedBy.value = `opened over the path selector${keyboard.value ? ' by keyboard' : ''}`
}

function choose(level: string) {
  chosen.value = levels.value[Number(level)]!.label
}
</script>

<template>
  <KitSim
    id="kit-sim-stack"
    title="Simulation: resource stack"
    intro="The real ResourceStack, opened at a point on the screen as a right-click opens it, or over a button as the header's path selector does. The innermost box's corner sits on the point; near an edge it flips and slides to stay on screen. Watch whether it moves as it opens."
  >
    <template #controls>
      <CwaUiSegmented
        v-model="depth"
        label="Levels"
        :options="depthOptions"
        data-testid="kit-sim-stack-depth"
      />
      <CwaUiButton
        v-for="spot in spotOptions"
        :key="spot.value"
        :label="spot.label"
        size="sm"
        :data-testid="`kit-sim-stack-${spot.value}`"
        @click="openAt(spot.value)"
      />
      <CwaUiButton
        label="Open via path selector"
        size="sm"
        variant="solid"
        data-testid="kit-sim-stack-path"
        @click="openOver"
      />
    </template>
    <KitDemo
      component="ResourceStack"
      :state="`${levels.length} levels${depth === 'more' ? ', parents behind Show more' : ''}${at ? `, ${openedBy}` : ', closed'}${chosen ? `; chose ${chosen}` : ''}`"
      wide
    >
      <span />
    </KitDemo>
    <ResourceStack
      v-if="at"
      :key="key"
      :levels="levels"
      selected="0"
      :at="at"
      :limit="limit"
      :keyboard="keyboard"
      :select="choose"
      @close="at = undefined"
    />
  </KitSim>
</template>
