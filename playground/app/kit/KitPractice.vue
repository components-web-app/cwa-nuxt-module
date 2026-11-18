<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useCwa, useRouter } from '#imports'
import { CwaComponentGroup, CwaUiButton, CwaUiSegmented, CwaUiToggle } from '#components'
import { Presence } from '#cwa/admin/presence'
import { useCloneMode } from '#cwa/admin/clone-mode'
import { NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'
import KitSim from './KitSim.vue'
import KitSlot from './KitSlot.vue'
import { createFakeSaveServer, kitFailures } from './fake-save-server'
import type { KitFailure } from './fake-save-server'
import { PRACTICE, practiceNewResource, practiceResources, practiceSelection, practiceStates } from './practice-fixtures'
import type { PracticeState } from './practice-fixtures'
import { practiceFetch } from './practice-transport'
import { typeInto, typeableIn } from './type-into'

const $cwa = useCwa()
const router = useRouter()
const internals = $cwa as unknown as {
  storage: { stores: { resources: { useStore: () => any }, auth: { useStore: () => any } } }
  auth: { authCookie: { value: string | null } }
  cwaFetch: { fetch: unknown }
}
const resourcesStore = internals.storage.stores.resources.useStore()
const authStore = internals.storage.stores.auth.useStore()
const stack = $cwa.admin.resourceStackManager
const clone = useCloneMode($cwa)
const server = createFakeSaveServer()

const ready = ref(false)
const state = ref<PracticeState>('draft')
const layout = ref(false)
const mia = ref(false)
const cloning = ref(false)
const status = ref('Setting up')

const nextOptions = [{ value: 'none', label: 'Succeeds' }, ...kitFailures]
const nextSave = computed({
  get: () => server.state.nextFailure ?? 'none',
  set: (value) => {
    server.failNext(value === 'none' ? undefined : value as KitFailure)
  },
})
const slow = computed({
  get: () => server.state.slow,
  set: (value) => {
    server.state.slow = !!value
  },
})

let restore: (() => void) | undefined
let presence: Presence | undefined

function storeAll(value: PracticeState) {
  for (const resource of practiceResources(value)) {
    $cwa.resourcesManager.storeResource({ resource })
  }
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function select(iri: string) {
  for (let attempt = 0; attempt < 40; attempt++) {
    $cwa.admin.eventBus.emit('selectResource', iri)
    await wait(50)
    if (stack.currentIri.value === iri) {
      return true
    }
  }
  return false
}

async function applyState(value: PracticeState) {
  status.value = `Selecting: ${practiceStates.find(option => option.value === value)!.label}`
  if (resourcesStore.adding) {
    resourcesStore.resetNewResource()
  }
  stack.resetStack()
  storeAll(value)
  await nextTick()
  const added = practiceNewResource(value)
  if (added) {
    resourcesStore.initNewResource(added.event, added.type, added.endpoint, added.isPublishable, false)
    await nextTick()
  }
  const target = added ? NEW_RESOURCE_IRI : practiceSelection(value)
  const selected = await select(target)
  status.value = selected ? `Selected: ${practiceStates.find(option => option.value === value)!.label}` : `Could not select ${target}`
}

function startPresence() {
  presence = new Presence($cwa, resourcesStore, router, 'kit-self')
  ;(presence as unknown as { send: () => Promise<void> }).send = async () => {}
  presence.start(true)
}

function showMia(on: boolean) {
  if (!presence) {
    return
  }
  const now = Date.now()
  const page = (presence as unknown as { state: { page?: string } }).state.page
  presence.receive({
    v: 1,
    clientId: 'kit-mia',
    user: { id: '/_/users/mia', name: 'Mia' },
    event: 'presence',
    data: on ? { v: 1, page, state: 'editing', component: PRACTICE.html, componentPosition: PRACTICE.body, field: 'html' } : { v: 1, page, state: 'left' },
    sentAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 3_600_000).toISOString(),
  } as never)
}

function setClone(on: boolean) {
  if (on) {
    clone.start(PRACTICE.title, 'Title', undefined, { positionIri: PRACTICE.heading, excerpt: 'Shaker kitchens' })
    $cwa.admin.setNavigationGuardDisabled(false)
    const target = document.querySelector<HTMLElement>('[data-kit-practice="empty"]')
    target && clone.setTarget([target])
    return
  }
  clone.end()
}

async function typeForMe() {
  const input = typeableIn(document.querySelector('[data-testid="manager-tab"]'))
  if (!input) {
    status.value = 'Open a tab with a text field first'
    return
  }
  await typeInto(input, ' and fitted by us', { clear: false })
}

watch(state, value => ready.value && void applyState(value))
watch(layout, (value) => {
  stack.isEditingLayout.value = value
})
watch(mia, showMia)
watch(cloning, setClone)

onMounted(async () => {
  const realFetch = internals.cwaFetch.fetch
  internals.cwaFetch.fetch = practiceFetch(realFetch as never, {
    server,
    current: iri => $cwa.resources.getResource(iri).value?.data,
    usage: iri => iri === PRACTICE.title ? { total: 2, positionCount: 2, pageDataCount: 0 } : { total: 1, positionCount: 1, pageDataCount: 0 },
  })
  const realCookie = internals.auth.authCookie
  internals.auth.authCookie = ref('1')
  const realUser = authStore.data.user
  authStore.data.user = { '@id': '/_/users/kit', '@type': 'User', 'username': 'kit', 'emailAddress': 'kit@example.test', 'enabled': true, 'roles': ['ROLE_ADMIN', 'ROLE_USER'], '_metadata': { persisted: true } }
  storeAll(state.value)
  ready.value = true
  $cwa.admin.toggleEdit(true)
  startPresence()
  restore = () => {
    clone.end()
    presence?.stop()
    $cwa.admin.toggleEdit(false)
    stack.resetStack()
    if (resourcesStore.adding) {
      resourcesStore.resetNewResource()
    }
    internals.auth.authCookie = realCookie
    authStore.data.user = realUser
    internals.cwaFetch.fetch = realFetch
    resourcesStore.evictResources(Object.values(PRACTICE))
  }
  await wait(100)
  await applyState(state.value)
})

onBeforeUnmount(() => restore?.())
</script>

<template>
  <main
    class="kit-practice"
    data-testid="kit-practice"
  >
    <KitSim
      id="kit-practice-chrome"
      title="In practice: editing on the page"
      intro="The real admin header, manager bar, selection outline, shared-instance outline, peer outlines, page and layout overlay, empty-group placeholder and clone highlight, on a fake page held in the real store. Saves go through the same fake adapter as the Kit tab. Click anything on the page to select it, as in the admin."
    >
      <template #controls>
        <div
          class="kit-practice-controls"
          @click.stop
        >
          <CwaUiSegmented
            v-model="state"
            label="Selected"
            :options="practiceStates"
            data-testid="kit-practice-state"
          />
          <CwaUiSegmented
            v-model="nextSave"
            label="Next save"
            :options="nextOptions"
            data-testid="kit-practice-next"
          />
          <CwaUiToggle
            v-model="slow"
            label="Slow (4 s)"
          />
          <CwaUiToggle
            v-model="layout"
            label="Editing the layout"
            data-testid="kit-practice-layout"
          />
          <CwaUiToggle
            v-model="mia"
            label="Mia edits the text"
            data-testid="kit-practice-mia"
          />
          <CwaUiToggle
            v-model="cloning"
            label="Cloning the title"
            data-testid="kit-practice-clone"
          />
          <CwaUiButton
            label="Type a sentence for me"
            size="sm"
            @click="typeForMe"
          />
          <CwaUiButton
            label="Reselect"
            size="sm"
            @click="applyState(state)"
          />
        </div>
      </template>
      <p
        class="kit-practice-status"
        data-testid="kit-practice-status"
      >
        {{ status }} · next save {{ nextSave }}{{ slow ? ', slow' : '' }}{{ mia ? ' · Mia on the text' : '' }}{{ cloning ? ' · cloning' : '' }}
      </p>
      <KitSlot
        name="the save-state outline on the selection (saving band, saved, error and conflict tints)"
        from="the module: ComponentFocus does not read field states yet"
      />
      <KitSlot
        name="inline editing on the phone sheet, and the confirm dialog on the kit"
        from="7c"
      />
    </KitSim>

    <div
      v-if="ready"
      class="kit-site"
      data-testid="kit-practice-site"
    >
      <div class="kit-site-head">
        <strong>Shaker &amp; Co</strong>
        <span>Kitchens · Bathrooms · Visit us</span>
      </div>
      <div
        class="kit-site-hero"
        data-kit-practice="main"
      >
        <CwaComponentGroup
          reference="main"
          :location="PRACTICE.page"
        />
      </div>
      <div
        class="kit-site-band"
        data-kit-practice="empty"
      >
        <CwaComponentGroup
          reference="empty"
          :location="PRACTICE.page"
        />
      </div>
    </div>
  </main>
</template>

<style scoped>
.kit-practice {
  display: block;
  padding-bottom: 8rem;
}

.kit-practice-controls {
  display: contents;
}

.kit-practice-status {
  flex: 1 1 100%;
  margin: 0;
  color: var(--cwa-color-fg-muted);
  font-size: 0.75rem;
}

.kit-site {
  margin-top: 1.5rem;
  background: #f7f3ee;
  color: #2b2520;
  font-family: Georgia, 'Times New Roman', serif;
}

.kit-site-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  padding: 1rem 1.5rem;
  background: #2b2520;
  color: #f7f3ee;
}

.kit-site-hero {
  padding: 2.5rem 1.5rem;
}

.kit-site-band {
  min-height: 6rem;
  padding: 1.5rem;
  background: #ece4da;
}
</style>
