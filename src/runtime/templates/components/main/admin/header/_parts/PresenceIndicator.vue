<script lang="ts" setup>
import { computed, ref } from 'vue'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { navigateTo } from '#app/composables/router'
import { useCwa } from '#cwa/composables/cwa'
import { getResourceTypeFromIri } from '#cwa/resources/resource-utils'
import { flushPendingUpdates, presenceColour, usePresence } from '#cwa/admin/presence'
import type { PresencePeer } from '#cwa/admin/presence'

interface Person {
  id: string
  name: string
  initials: string
  colour: string
  tabs: number
}

const $cwa = useCwa()
const { active, paused, onThisPage, elsewhere } = usePresence($cwa)
const open = ref(false)

function nameOf(peer: PresencePeer) {
  return peer.user.name || 'Someone'
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
      continue
    }
    const name = nameOf(peer)
    byUser.set(peer.user.id, { id: peer.user.id, name, initials: initialsOf(name), colour: presenceColour(peer.user.id), tabs: 1 })
  }
  return [...byUser.values()]
}

const here = computed(() => people(onThisPage.value))
const elsewhereCount = computed(() => people(elsewhere.value).length)
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
  if (peer.state !== 'selected') {
    return 'Viewing'
  }
  const type = stored(peer.component)?.['@type']
  return `Selected ${type ? $cwa.resourcesConfig[type]?.name || type : 'a component'}`
}

async function goTo(page: string) {
  open.value = false
  await flushPendingUpdates($cwa)
  const path = routePathOf(page)
  const query = { cwa_force: 'true' }
  await navigateTo(path ? { path, query } : { name: '_cwa-resource-page', params: { cwaPage0: page }, query })
}
</script>

<template>
  <span
    v-if="active && paused"
    data-testid="presence-paused"
    class="cwa:self-center cwa:whitespace-nowrap cwa:text-sm cwa:text-stone-400"
  >Live editing paused</span>
  <PopoverRoot
    v-else-if="active && rows.length"
    v-model:open="open"
  >
    <PopoverTrigger
      data-testid="presence-indicator"
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
          :title="person.tabs > 1 ? `${person.name} · ${person.tabs} tabs` : person.name"
          :style="{ backgroundColor: person.colour }"
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
            class="cwa:flex cwa:flex-wrap cwa:items-center cwa:gap-x-2"
          >
            <span
              aria-hidden="true"
              :style="{ backgroundColor: presenceColour(peer.user.id) }"
              class="cwa:h-2.5 cwa:w-2.5 cwa:rounded-full"
            />
            <span>{{ nameOf(peer) }}</span>
            <span
              v-if="isHere"
              class="cwa:text-yellow"
            >This page</span>
            <a
              v-else-if="routePathOf(peer.page)"
              :href="routePathOf(peer.page)"
              class="cwa:underline cwa:underline-offset-2 cwa:hover:text-white"
              @click.prevent="goTo(peer.page)"
            >{{ pageLabel(peer.page) }}</a>
            <button
              v-else
              type="button"
              class="cwa:underline cwa:underline-offset-2 cwa:hover:text-white cwa:cursor-pointer"
              @click="goTo(peer.page)"
            >
              {{ pageLabel(peer.page) }}
            </button>
            <span class="cwa:text-stone-400">{{ activity(peer) }}</span>
          </li>
        </ul>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
