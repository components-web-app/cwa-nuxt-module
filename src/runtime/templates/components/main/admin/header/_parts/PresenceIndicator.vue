<script lang="ts" setup>
import { computed, ref } from 'vue'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { navigateTo, useRouter } from '#app/composables/router'
import { useCwa } from '#cwa/composables/cwa'
import { useCwaResourceRoute } from '#cwa/composables/useCwaResourceRoute'
import { getResourceTypeFromIri } from '#cwa/resources/resource-utils'
import { peerColour, usePresence } from '#cwa/admin/presence'
import type { PresencePeer } from '#cwa/admin/presence'

interface Person {
  id: string
  name: string
  initials: string
  colour: string
  tabs: number
  isSelf: boolean
  idle: boolean
}

const $cwa = useCwa()
const { active, paused, onThisPage, elsewhere } = usePresence($cwa)
const open = ref(false)
const { getInternalResourceLink } = useCwaResourceRoute()
const router = useRouter()

function nameOf(peer: PresencePeer) {
  return peer.isSelf ? 'You · other window' : peer.user.name || 'Someone'
}

function initialsOf(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]!.toUpperCase()).join('')
}

function people(peers: PresencePeer[]) {
  const byUser = new Map<string, Person>()
  for (const peer of peers) {
    const person = byUser.get(peer.user.id)
    if (person) {
      person.tabs++
      person.idle &&= peer.state === 'idle'
      continue
    }
    const name = nameOf(peer)
    byUser.set(peer.user.id, { id: peer.user.id, name, initials: peer.isSelf ? 'You' : initialsOf(name), colour: peerColour(peer), tabs: 1, isSelf: peer.isSelf, idle: peer.state === 'idle' })
  }
  return [...byUser.values()]
}

const here = computed(() => people(onThisPage.value))
const elsewhereCount = computed(() => {
  const hereIds = new Set(here.value.map(person => person.id))
  return people(elsewhere.value).filter(person => !person.isSelf && !hereIds.has(person.id)).length
})
const label = computed(() => {
  const names = here.value.map(person => person.tabs > 1 ? `${person.name} (${person.tabs} tabs)` : person.name)
  const parts = names.length ? [`${names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]} on this page`] : []
  if (elsewhereCount.value) {
    parts.push(`${elsewhereCount.value} other ${elsewhereCount.value === 1 ? 'editor' : 'editors'} elsewhere`)
  }
  return `${parts.join(', ')}. Show editors`
})
const rows = computed(() => [
  ...onThisPage.value.map(peer => ({ peer, here: true })),
  ...elsewhere.value.map(peer => ({ peer, here: false })),
])

function stored(iri: string | undefined) {
  return iri ? $cwa.resources.getResource(iri).value?.data : undefined
}

function routePathOf(page: string): string | undefined {
  if (!getResourceTypeFromIri(page)) {
    return page
  }
  const route = stored(page)?.route
  const path = typeof route === 'string' ? stored(route)?.path : undefined
  return typeof path === 'string' ? path : undefined
}

function pageLabel(page: string) {
  const data = stored(page)
  return data?.title || data?.reference || routePathOf(page) || page
}

function activity(peer: PresencePeer) {
  if (peer.state === 'idle') {
    return 'Idle'
  }
  if (peer.state !== 'selected' && peer.state !== 'editing') {
    return 'Viewing'
  }
  const type = stored(peer.component)?.['@type']
  return `${peer.state === 'editing' ? 'Editing' : 'Selected'} ${type ? $cwa.resourcesConfig[type]?.name || type : 'a component'}`
}

function locationOf(page: string) {
  const path = routePathOf(page)
  const query = { cwa_force: 'true' }
  return path ? { path, query } : { ...getInternalResourceLink(page), query }
}

async function goTo(event: MouseEvent, page: string) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return
  }
  event.preventDefault()
  open.value = false
  await $cwa.resourcesManager.flushPendingUpdates()
  await navigateTo(locationOf(page))
}
</script>

<template>
  <span
    v-if="active && paused"
    data-testid="presence-paused"
    role="status"
    title="Other editors' changes and who is here will catch up when the connection returns. You can keep editing."
    class="cwa:self-center cwa:whitespace-nowrap cwa:text-sm cwa:text-stone-400"
  >Live editing paused</span>
  <PopoverRoot
    v-else-if="active && (here.length || elsewhereCount)"
    v-model:open="open"
  >
    <PopoverTrigger
      data-testid="presence-indicator"
      :aria-label="label"
      class="cwa:flex cwa:items-center cwa:gap-x-2 cwa:cursor-pointer cwa:rounded-full cwa:focus-visible:outline-2 cwa:focus-visible:outline-stone-400"
    >
      <span
        v-if="here.length"
        class="cwa:flex cwa:-space-x-1.5"
      >
        <span
          v-for="person in here"
          :key="person.id"
          data-testid="presence-avatar"
          :data-idle="person.idle || undefined"
          :title="person.tabs > 1 ? `${person.name} · ${person.tabs} tabs` : person.name"
          :style="{ backgroundColor: person.colour }"
          :class="{ 'cwa:opacity-50': person.idle }"
          class="cwa:relative cwa:flex cwa:items-center cwa:justify-center cwa:h-7 cwa:w-7 cwa:rounded-full cwa:text-xs cwa:font-bold cwa:text-dark cwa:border-2 cwa:border-dark"
        >{{ person.initials }}<span
          v-if="person.tabs > 1"
          class="cwa:absolute cwa:-top-1 cwa:-right-1 cwa:text-[10px] cwa:leading-none cwa:px-1 cwa:py-0.5 cwa:rounded-full cwa:bg-dark cwa:text-light"
        >{{ person.tabs }}</span></span>
      </span>
      <span
        v-if="elsewhereCount"
        data-testid="presence-elsewhere"
        class="cwa:whitespace-nowrap cwa:text-sm cwa:text-stone-400"
      >+{{ elsewhereCount }} elsewhere</span>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        side="bottom"
        align="start"
        :side-offset="8"
        data-testid="presence-list"
        class="cwa:z-context cwa:min-w-[220px] cwa:max-w-sm cwa:max-h-[50vh] cwa:overflow-y-auto cwa:p-3 cwa:rounded-lg cwa:dark-blur cwa:outline-dotted cwa:outline-1 cwa:outline-stone-400 cwa:shadow-lg cwa:text-sm cwa:text-light"
      >
        <ul class="cwa:flex cwa:flex-col cwa:gap-y-2">
          <li
            v-for="{ peer, here: isHere } in rows"
            :key="peer.clientId"
            data-testid="presence-row"
            :data-idle="peer.state === 'idle' || undefined"
            :class="{ 'cwa:opacity-50': peer.state === 'idle' }"
            class="cwa:flex cwa:flex-wrap cwa:items-center cwa:gap-x-2"
          >
            <span
              aria-hidden="true"
              :style="{ backgroundColor: peerColour(peer) }"
              class="cwa:h-2.5 cwa:w-2.5 cwa:rounded-full"
            />
            <span>{{ nameOf(peer) }}</span>
            <span
              v-if="peer.device"
              class="cwa:text-stone-400"
            >{{ peer.device }}</span>
            <span
              v-if="isHere"
              class="cwa:text-yellow"
            >This page</span>
            <a
              v-else
              :href="router.resolve(locationOf(peer.page)).href"
              class="cwa:underline cwa:underline-offset-2 cwa:hover:text-white"
              @click="goTo($event, peer.page)"
            >{{ pageLabel(peer.page) }}</a>
            <span class="cwa:text-stone-400">{{ activity(peer) }}</span>
          </li>
        </ul>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
