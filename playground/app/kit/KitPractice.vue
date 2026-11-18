<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useCwa, useRouter } from '#imports'
import { CwaComponentGroup, CwaUiButton, CwaUiSelect, CwaUiToggle, LazyCwaAdminHeader, LazyCwaAdminResourceManager, LazyCwaAdminResourceManagerLayoutPageOverlay } from '#components'
import { Presence } from '#cwa/admin/presence'
import { RemoteChanges } from '#cwa/admin/remote-changes'
import { useCloneMode } from '#cwa/admin/clone-mode'
import { NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'
import { createFakeSaveServer, kitFailures } from './fake-save-server'
import type { KitFailure } from './fake-save-server'
import { PRACTICE, practiceNewResource, practiceResources, practiceSelection, practiceStates } from './practice-fixtures'
import type { PracticeState } from './practice-fixtures'
import { practiceFetch } from './practice-transport'
import { typeInto, typeableIn } from './type-into'

const MIA = { clientId: 'kit-mia', userId: '/_/users/mia', name: 'Mia' }
const DISPLAY_TOKEN = 'kit-practice'

const $cwa = useCwa()
const router = useRouter()
const internals = $cwa as unknown as {
  storage: { stores: { resources: { useStore: () => any }, auth: { useStore: () => any }, fetcher: { useStore: () => any } } }
  auth: { authCookie: { value: string | null } }
  cwaFetch: { fetch: unknown }
}
const resourcesStore = internals.storage.stores.resources.useStore()
const authStore = internals.storage.stores.auth.useStore()
const fetcherStore = internals.storage.stores.fetcher.useStore()
const stack = $cwa.admin.resourceStackManager
const clone = useCloneMode($cwa)
const server = createFakeSaveServer()
server.theirs.title = 'Shaker kitchens, made in Kent'
server.theirs.html = '<p>Mia rewrote this paragraph.</p>'

const ready = ref(false)
const busy = ref(false)
const chrome = useTemplateRef<HTMLElement>('chrome')
const site = useTemplateRef<HTMLElement>('site')
const bar = useTemplateRef<HTMLElement>('bar')
const manager = ref<InstanceType<typeof LazyCwaAdminResourceManager> | null>(null)
const state = ref<PracticeState>('draft')
const layout = ref(false)
const mia = ref(false)
const cloning = ref(false)
const note = ref('')

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

const names: Record<string, string> = {
  [PRACTICE.title]: 'Title (one component shown twice)',
  [PRACTICE.html]: 'Body text',
  [PRACTICE.group]: 'Main group',
  [PRACTICE.empty]: 'Empty group',
  [PRACTICE.heading]: 'Position of the first title',
  [PRACTICE.body]: 'Position of the body text',
  [PRACTICE.repeat]: 'Position of the second title',
  [PRACTICE.page]: 'The page',
  [NEW_RESOURCE_IRI]: 'A new component, not saved yet',
}

const selected = computed(() => {
  const iri = stack.currentIri.value
  return iri ? names[iri] ?? iri : 'nothing'
})

const status = computed(() => {
  if (!ready.value || busy.value) {
    return 'Setting up the page…'
  }
  const parts = [
    $cwa.admin.isEditing ? `Editing. Selected: ${selected.value}` : 'Not editing. Page settings is in the header.',
    nextSave.value === 'none' ? 'the next save succeeds' : `the next save fails: ${nextOptions.find(option => option.value === nextSave.value)!.label}`,
  ]
  slow.value && parts.push('saves take 4 s')
  return parts.join(' · ')
})

let restore: (() => void) | undefined
let presence: Presence | undefined
let remote: RemoteChanges | undefined

function storeAll(value: PracticeState) {
  for (const resource of practiceResources(value)) {
    $cwa.resourcesManager.storeResource({ resource })
  }
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function select(iri: string, via = iri) {
  for (let attempt = 0; attempt < 40; attempt++) {
    $cwa.admin.eventBus.emit('selectResource', via)
    await wait(50)
    const index = stack.resourceStack.value.findIndex(item => item.iri === iri)
    if (index > 0) {
      await stack.selectStackIndex(index, false)
      await wait(50)
    }
    if (stack.currentIri.value === iri) {
      return true
    }
  }
  return false
}

async function applyState(value: PracticeState) {
  busy.value = true
  note.value = ''
  clone.end()
  cloning.value = false
  if (!$cwa.admin.isEditing) {
    $cwa.admin.toggleEdit(true)
  }
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
  if (!await select(target, value === 'group' ? PRACTICE.title : target)) {
    note.value = `Could not select ${names[target] ?? target}. Choose Start again.`
  }
  busy.value = false
}

function presenceMessage(data: Record<string, unknown>) {
  const now = Date.now()
  return {
    v: 1,
    clientId: MIA.clientId,
    user: { id: MIA.userId, name: MIA.name },
    event: 'presence',
    data: { v: 1, page: (presence as unknown as { state: { page?: string } }).state.page, ...data },
    sentAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 3_600_000).toISOString(),
  } as never
}

function startPresence() {
  presence = new Presence($cwa, resourcesStore, router, 'kit-self')
  ;(presence as unknown as { send: () => Promise<void> }).send = async () => {}
  presence.start(true)
  presence.receive(presenceMessage({ state: 'viewing' }))
}

function showMia(on: boolean) {
  presence?.receive(presenceMessage(on
    ? { state: 'editing', component: PRACTICE.html, componentPosition: PRACTICE.body, field: 'html' }
    : { state: 'viewing' }))
}

function setClone(on: boolean) {
  if (!on) {
    clone.end()
    return
  }
  if (!$cwa.admin.isEditing) {
    $cwa.admin.toggleEdit(true)
  }
  clone.start(PRACTICE.title, 'Title', undefined, { positionIri: PRACTICE.heading, excerpt: 'Shaker kitchens' })
  $cwa.admin.setNavigationGuardDisabled(false)
  const target = site.value?.querySelector<HTMLElement>('[data-kit-practice="empty"]')
  target && clone.setTarget([target])
}

async function typeForMe() {
  const input = typeableIn(bar.value)
  if (!input) {
    note.value = 'Select the title or a new component first: the bar has no text field for this selection.'
    return
  }
  note.value = ''
  input.focus()
  await typeInto(input, ' and fitted by us', { clear: false })
}

async function openPageSettings() {
  if ($cwa.admin.isEditing) {
    $cwa.admin.toggleEdit(false)
    await wait(100)
  }
  document.querySelector<HTMLElement>('[data-testid="page-settings"]')?.click()
}

function inSite(event: MouseEvent) {
  return !!site.value?.contains(event.target as Node)
}

function onClick(event: MouseEvent) {
  manager.value?.clickHandler(event, inSite(event) ? 'page' : 'layout')
}

function onContextMenu(event: MouseEvent) {
  manager.value?.contextMenuHandler(event, inSite(event) ? 'page' : 'layout')
}

watch(state, value => ready.value && void applyState(value))
watch(layout, (value) => {
  stack.isEditingLayout.value = value
})
watch(mia, showMia)
watch(cloning, setClone)
watch(() => clone.source.value, (source) => {
  if (!source) {
    cloning.value = false
  }
})

onMounted(async () => {
  const realFetch = internals.cwaFetch.fetch
  internals.cwaFetch.fetch = practiceFetch(realFetch as never, {
    server,
    current: iri => $cwa.resources.getResource(iri).value?.data,
    usage: iri => iri === PRACTICE.title ? { total: 2, positionCount: 2, pageDataCount: 0 } : { total: 1, positionCount: 1, pageDataCount: 0 },
    members: collection => Object.values(PRACTICE).filter(iri => iri.startsWith(`${collection}/`)).flatMap(iri => $cwa.resources.getResource(iri).value?.data ?? []),
    peer: MIA,
  })
  const realCookie = internals.auth.authCookie
  internals.auth.authCookie = ref('1')
  const realUser = authStore.data.user
  authStore.data.user = { '@id': '/_/users/kit', '@type': 'User', 'username': 'you', 'emailAddress': 'you@example.test', 'enabled': true, 'roles': ['ROLE_ADMIN', 'ROLE_USER'], '_metadata': { persisted: true } }
  storeAll(state.value)
  const realDisplayed = fetcherStore.primaryFetch.displayedToken
  fetcherStore.fetches[DISPLAY_TOKEN] = { path: PRACTICE.page, isPrimary: true, resources: Object.values(PRACTICE), timestamp: Date.now() }
  fetcherStore.primaryFetch.displayedToken = DISPLAY_TOKEN
  const wasEditing = $cwa.admin.isEditing
  remote = new RemoteChanges($cwa, resourcesStore)
  remote.connect()
  ready.value = true
  $cwa.admin.toggleEdit(true)
  startPresence()
  restore = () => {
    clone.end()
    presence?.stop()
    remote?.disconnect()
    stack.resetStack()
    $cwa.admin.toggleEdit(wasEditing)
    if (resourcesStore.adding) {
      resourcesStore.resetNewResource()
    }
    fetcherStore.primaryFetch.displayedToken = realDisplayed
    delete fetcherStore.fetches[DISPLAY_TOKEN]
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
    <Teleport
      v-if="ready"
      to="body"
    >
      <div
        ref="bar"
        class="kit-practice-chrome"
        data-testid="kit-practice-chrome"
      >
        <LazyCwaAdminHeader />
        <LazyCwaAdminResourceManager ref="manager" />
      </div>
    </Teleport>
    <section aria-labelledby="kit-practice-title">
      <h2
        id="kit-practice-title"
        class="kit-practice-heading"
      >
        In practice: editing on the page
      </h2>
      <p class="kit-practice-lead">
        The real admin on a fake page. Saves go to a fake server in this tab, so nothing leaves the browser. The title is already selected: change it in the bar at the bottom.
      </p>
      <p
        class="kit-practice-status"
        role="status"
        data-testid="kit-practice-status"
      >
        {{ status }}
      </p>
      <p
        v-if="note"
        class="kit-practice-note"
        data-testid="kit-practice-note"
      >
        {{ note }}
      </p>
      <div class="kit-practice-grid">
        <div
          v-if="ready"
          ref="chrome"
          class="kit-site-frame"
          @click="onClick"
          @contextmenu="onContextMenu"
        >
          <LazyCwaAdminResourceManagerLayoutPageOverlay
            v-if="site && chrome"
            :page="site"
            :layout="chrome"
          />
          <div class="kit-site-head">
            <strong>Shaker &amp; Co</strong>
            <span>Kitchens · Bathrooms · Visit us</span>
          </div>
          <div
            ref="site"
            class="kit-site"
            data-testid="kit-practice-site"
          >
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
        </div>

        <div
          class="kit-practice-panel"
          role="group"
          aria-label="Simulation controls"
        >
          <div class="kit-practice-control">
            <CwaUiSelect
              v-model="state"
              label="Selected"
              :options="practiceStates"
              data-testid="kit-practice-state"
            />
            <p class="kit-try">
              <strong>Try:</strong> each state changes the bar's tabs, its status and Publish. Or click anything on the page; right-click it for the stack.
            </p>
          </div>
          <div class="kit-practice-control">
            <CwaUiSelect
              v-model="nextSave"
              label="Next save"
              :options="nextOptions"
              data-testid="kit-practice-next"
            />
            <CwaUiToggle
              v-model="slow"
              label="Slow (4 s)"
              data-testid="kit-practice-slow"
            />
            <p class="kit-try">
              <strong>Try:</strong> choose 500, then edit the title in the bar. The outline on the page sweeps while it saves, then turns red; hover the field for Retry. 412 brings Mia's version as a conflict, in amber. Slow keeps the sweep going longer.
            </p>
          </div>
          <div class="kit-practice-control">
            <CwaUiButton
              label="Type a sentence for me"
              size="sm"
              data-testid="kit-practice-type"
              @click="typeForMe"
            />
            <p class="kit-try">
              <strong>Try:</strong> types into the bar's first text field, so you can watch it save, in the bar and on the selection's outline.
            </p>
          </div>
          <div class="kit-practice-control">
            <CwaUiToggle
              v-model="mia"
              label="Mia edits the body text"
              data-testid="kit-practice-mia"
            />
            <p class="kit-try">
              <strong>Try:</strong> her outline and name appear on the paragraph, and in the header.
            </p>
          </div>
          <div class="kit-practice-control">
            <CwaUiToggle
              v-model="layout"
              label="Editing the layout"
              data-testid="kit-practice-layout"
            />
            <p class="kit-try">
              <strong>Try:</strong> the hatching moves from the site's header bar to the page.
            </p>
          </div>
          <div class="kit-practice-control">
            <CwaUiToggle
              v-model="cloning"
              label="Cloning the title"
              data-testid="kit-practice-clone"
            />
            <p class="kit-try">
              <strong>Try:</strong> the title is marked as the source and the empty group as the target. Cancel in the header ends it.
            </p>
          </div>
          <div class="kit-practice-control">
            <CwaUiButton
              label="Open page settings"
              size="sm"
              data-testid="kit-practice-settings"
              @click="openPageSettings"
            />
            <p class="kit-try">
              <strong>Try:</strong> leaves edit mode and opens the page's settings, as the header's button does.
            </p>
          </div>
          <div class="kit-practice-control">
            <CwaUiButton
              label="Start again"
              size="sm"
              data-testid="kit-practice-reset"
              @click="applyState(state)"
            />
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.kit-practice {
  display: block;
  padding-bottom: 8rem;
}

.kit-practice-heading {
  margin: 0 0 0.5rem;
  font-size: 1.125rem;
  font-weight: 600;
}

.kit-practice-lead {
  max-width: 50rem;
  margin: 0 0 0.5rem;
  color: var(--cwa-color-fg-muted);
}

.kit-practice-status,
.kit-practice-note {
  margin: 0 0 1rem;
  font-size: 0.8125rem;
}

.kit-practice-note {
  color: var(--cwa-color-warning-fg, var(--cwa-color-fg));
}

.kit-practice-grid {
  display: grid;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

@media (min-width: 1024px) {
  .kit-practice-grid {
    grid-template-columns: minmax(0, 1fr) 20rem;
    align-items: start;
  }
}

.kit-practice-panel {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  background: var(--cwa-color-surface-raised);
}

.kit-practice-control {
  display: grid;
  gap: 0.5rem;
}

.kit-try {
  margin: 0;
  color: var(--cwa-color-fg-muted);
  font-size: 0.8125rem;
}

.kit-practice-chrome {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 0;
}

.kit-site-frame {
  position: relative;
  overflow: clip;
  font-family: Georgia, 'Times New Roman', serif;
  box-shadow: 0 0 0 1px var(--cwa-color-line);
}

.kit-site-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  padding: 1rem 1.5rem;
  background: #10201b;
  color: #e8efe9;
}

.kit-site {
  background: #1b2e27;
  color: #f1f5f2;
}

.kit-site-hero {
  padding: 2rem 1.5rem;
}

.kit-site-band {
  min-height: 6rem;
  padding: 1.5rem;
  background: #16261f;
}
</style>
