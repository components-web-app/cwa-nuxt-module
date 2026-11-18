<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCwaToast } from '#imports'
import { CwaUiButton, CwaUiSegmented, CwaUiToggle, CwaUiTree } from '#components'
import KitSim from './KitSim.vue'
import KitDemo from './KitDemo.vue'
import KitFieldPlace from './KitFieldPlace.vue'
import { createFakeSaveServer, kitFailures } from './fake-save-server'
import type { KitFailure } from './fake-save-server'
import { kitFieldSet } from './kit-field-set'
import type { KitPlace } from './kit-field-set'
import type { TreeNode } from '../../../src/runtime/templates/components/ui/Tree.vue'

const server = createFakeSaveServer()
const set = kitFieldSet(server)
const place = ref<KitPlace>('page')
const toast = useCwaToast()
const routeResult = ref('')

const nextOptions = [{ value: 'none', label: 'Succeeds' }, ...kitFailures]
const placeOptions = [{ value: 'page', label: 'Page' }, { value: 'bar', label: 'Manager row' }, { value: 'dialog', label: 'Dialog' }]

const nextSave = computed({
  get: () => server.state.nextFailure ?? 'none',
  set: (value) => {
    server.failNext(value === 'none' ? undefined : value as KitFailure)
  },
})
const offline = computed({
  get: () => server.state.offline,
  set: (value) => {
    server.state.offline = !!value
  },
})
const slow = computed({
  get: () => server.state.slow,
  set: (value) => {
    server.state.slow = !!value
  },
})

const routes: TreeNode[] = [
  { key: '/kitchens', label: '/kitchens', children: [{ key: '/kitchens/shaker', label: '/kitchens/shaker' }] },
  { key: '/old-kitchens', label: '/old-kitchens' },
]

async function runRouteAction(label: string, node: TreeNode) {
  routeResult.value = `${label} ${node.label}…`
  try {
    await server.routeAction()
    routeResult.value = `${label} ${node.label}: done`
    toast.show({ tone: 'success', title: `${label} ${node.label}`, description: 'The route action went through.' })
  }
  catch {
    routeResult.value = `${label} ${node.label}: failed`
    toast.show({
      id: `kit-route-${node.key}`,
      tone: 'error',
      title: `${label} ${node.label} didn’t work`,
      description: server.state.offline ? 'You are offline.' : 'The server could not do it.',
      actions: [{ label: 'Retry', primary: true, onClick: () => void runRouteAction(label, node) }],
    })
  }
}

const routeActions = (node: TreeNode) => [
  { label: `Delete ${node.label}`, danger: true, delete: true, run: () => void runRouteAction('Delete', node) },
  { label: `More actions for ${node.label}`, menu: [{ label: 'Make it a redirect', onSelect: () => void runRouteAction('Redirect', node) }] },
]
</script>

<template>
  <KitSim
    id="kit-sim-failures"
    title="Simulation: failures"
    intro="Type in any field: it saves 250 ms after you stop, through a fake adapter that answers like the API. Choose how the next save answers, or go offline or slow for all of them. A 422 marks the field with its violation, a 500 and offline offer Retry and Reset, a 412 holds Mia's value as a conflict. Route actions in the tree run through the same adapter."
  >
    <template #controls>
      <CwaUiSegmented
        v-model="nextSave"
        label="Next save"
        :options="nextOptions"
        data-testid="kit-sim-failures-next"
      />
      <CwaUiToggle
        v-model="offline"
        label="Offline"
        data-testid="kit-sim-failures-offline"
      />
      <CwaUiToggle
        v-model="slow"
        label="Slow (4 s)"
        data-testid="kit-sim-failures-slow"
      />
      <CwaUiButton
        label="Make the next route action fail"
        size="sm"
        :disabled="server.state.nextRouteFailure"
        disabled-reason="The next route action already fails"
        data-testid="kit-sim-failures-route"
        @click="server.failNextRouteAction()"
      />
      <CwaUiSegmented
        v-model="place"
        label="In"
        :options="placeOptions"
      />
    </template>
    <KitFieldPlace
      :set="set"
      :place="place"
      :state="`${server.state.requests} saves sent`"
      :only="['input', 'textarea', 'number', 'toggle', 'select', 'multi', 'segmented', 'date', 'search']"
      test-id="kit-sim-failures-fields"
      @close-dialog="place = 'page'"
    />
    <KitDemo
      component="CwaUiTree"
      :state="routeResult || (server.state.nextRouteFailure ? 'next route action fails' : 'route actions succeed')"
      wide
    >
      <CwaUiTree
        label="Routes, with actions that go through the fake adapter"
        :nodes="routes"
        :actions="routeActions"
        data-testid="kit-sim-failures-tree"
      />
    </KitDemo>
  </KitSim>
</template>
