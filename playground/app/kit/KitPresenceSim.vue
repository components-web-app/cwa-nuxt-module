<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef } from 'vue'
import { CwaUiButton, CwaUiMultiSelect, CwaUiSegmented } from '#components'
import KitSim from './KitSim.vue'
import KitFieldPlace from './KitFieldPlace.vue'
import { createFakeSaveServer, kitMia } from './fake-save-server'
import { kitFieldKeys, kitFieldLabels, kitFieldSet } from './kit-field-set'
import type { KitFieldKey, KitPlace } from './kit-field-set'
import { typeInto, typeableIn } from './type-into'

const server = createFakeSaveServer()
const set = kitFieldSet(server)
const place = ref<KitPlace>('bar')
const demos = useTemplateRef<HTMLElement>('demos')
const status = ref('')
let typing: ReturnType<typeof setInterval> | undefined

const placeOptions = [{ value: 'page', label: 'Page' }, { value: 'bar', label: 'Manager row' }, { value: 'dialog', label: 'Dialog' }]
const fieldOptions = kitFieldKeys.map(key => ({ value: key, label: kitFieldLabels[key].label }))

const miaOn = computed({
  get: () => kitFieldKeys.filter(key => set[key].peers.value.length),
  set: (keys: string[] | null | undefined) => {
    for (const key of kitFieldKeys) {
      set[key].peers.value = keys?.includes(key) ? [kitMia] : []
    }
  },
})

function stopTyping() {
  clearInterval(typing)
  typing = undefined
}

function miaEditsTitle() {
  stopTyping()
  const title = set.input
  title.peers.value = [kitMia]
  const sentence = ' and made to measure'
  const start = String(title.saved.value ?? '')
  let index = 0
  status.value = 'Mia is typing in Title'
  typing = setInterval(() => {
    index++
    title.remote(`${start}${sentence.slice(0, index)}`)
    if (title.state.value.status === 'conflict' || index >= sentence.length) {
      stopTyping()
      status.value = title.state.value.status === 'conflict' ? 'Mia’s typing landed while you had an unsent change: conflict' : 'Mia finished; she leaves Title in 3 s'
      setTimeout(() => {
        title.peers.value = []
      }, 3000)
    }
  }, 160)
}

function armRemote() {
  set.input.peers.value = [kitMia]
  set.input.armRemoteOnNextEdit('Shaker kitchens | Mia’s version')
  status.value = 'Type in Title: Mia’s save lands on your next keystroke'
}

function fieldElement(key: KitFieldKey) {
  const root = place.value === 'dialog' ? document : demos.value
  return root?.querySelector(`[data-kit-field="${key}"]`)
}

async function typeForMe() {
  const input = typeableIn(fieldElement('input'))
  if (input) {
    status.value = 'Typing in Title for you'
    await typeInto(input, 'Shaker kitchens, built by hand in Kent', { delay: 60 })
    status.value = ''
  }
}

onBeforeUnmount(stopTyping)
</script>

<template>
  <KitSim
    id="kit-sim-presence"
    title="Simulation: presence and remote changes"
    intro="Mia is a fake peer handed to each field through the model's focusedBy, the same way the presence layer hands real peers in. Put her on any field, let her type into Title, or have her save land while you are typing, which raises the real conflict."
  >
    <template #controls>
      <CwaUiMultiSelect
        v-model="miaOn"
        label="Mia is in"
        :options="fieldOptions"
        data-testid="kit-sim-presence-fields"
      />
      <CwaUiButton
        label="Mia edits Title"
        size="sm"
        data-testid="kit-sim-presence-types"
        @click="miaEditsTitle"
      />
      <CwaUiButton
        label="Mia’s save lands as you type"
        size="sm"
        data-testid="kit-sim-presence-arm"
        @click="armRemote"
      />
      <CwaUiButton
        label="Type a sentence for me"
        size="sm"
        data-testid="kit-sim-presence-type-for-me"
        @click="typeForMe"
      />
      <CwaUiButton
        label="Mia leaves"
        size="sm"
        variant="ghost"
        @click="miaOn = []; stopTyping()"
      />
      <CwaUiSegmented
        v-model="place"
        label="In"
        :options="placeOptions"
      />
    </template>
    <div
      ref="demos"
      class="kit-presence-demos"
    >
      <KitFieldPlace
        :set="set"
        :place="place"
        :state="status || (miaOn.length ? `Mia in ${miaOn.length} field${miaOn.length === 1 ? '' : 's'}` : 'nobody else here')"
        test-id="kit-sim-presence-place"
        @close-dialog="place = 'page'"
      />
    </div>
  </KitSim>
</template>

<style scoped>
.kit-presence-demos {
  display: flex;
  flex: 1 1 100%;
  min-width: 0;
}
</style>
