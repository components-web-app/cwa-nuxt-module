// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, shallowRef } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { ResourcesStore } from '../storage/stores/resources/resources-store'
import type { CwaResourcesStoreInterface } from '../storage/stores/resources/resources-store'
import type { ModelEditor, RemoteFieldChange } from '../resources/model-editors'
import { registerModelEditor } from '../resources/model-editors'
import { CLIENT_ID_HEADER, RemoteChanges, subscribeToRemoteChanges } from './remote-changes'
import { Presence } from './presence'
import type { Router } from 'vue-router'
import type Cwa from '#cwa/cwa'

const cloneMode = vi.hoisted(() => ({
  source: { value: undefined as undefined | { iri: string, move?: { positionIri: string } } },
  end: vi.fn(),
}))
vi.mock('#cwa/admin/clone-mode', () => ({
  useCloneMode: vi.fn(() => cloneMode),
}))

const DRAFT = '/component/titles/draft'
const LIVE = '/component/titles/live'
const GROUP = '/_/component_groups/top'

function buildCwa() {
  const stack = shallowRef<{ iri: string }[]>([])
  const shownVersion = shallowRef<string>()
  const currentIri = computed(() => shownVersion.value ?? stack.value[0]?.iri)
  const groupWrites = new Map<string, Promise<void>>()
  const $cwa = {
    cwaFetch: { writeHeaders: {} as Record<string, string>, fetch: vi.fn().mockResolvedValue(undefined) },
    apiUrlBase: 'https://api.test',
    auth: { user: { '@id': '/_/users/1' } },
    resources: { displayPageIri: computed(() => '/_/pages/home') },
    admin: {
      resourceStackManager: { resourceStack: stack, currentIri },
      emptyStack: vi.fn(() => {
        stack.value = []
      }),
    },
    resourcesManager: {
      groupWritesSettled: (iri: string) => groupWrites.get(iri) ?? Promise.resolve(),
      isUpdating: (iri: string) => groupWrites.has(iri),
      queueComponentGroupWrite: vi.fn((iri: string, write: () => Promise<unknown>) => {
        const next = (groupWrites.get(iri) ?? Promise.resolve()).then(write)
        const settled = next.then(() => undefined, () => undefined)
        groupWrites.set(iri, settled)
        void settled.then(() => groupWrites.get(iri) === settled && groupWrites.delete(iri))
        return next
      }),
      updateResource: vi.fn().mockResolvedValue({ '@id': '/component/titles/new-draft' }),
      addError: vi.fn(),
    },
  }
  return { $cwa: $cwa as unknown as Cwa, mocks: $cwa, stack, shownVersion }
}

function fakeEditor({ iri, field, ...overrides }: Partial<Omit<ModelEditor, 'iri' | 'field'>> & { iri: string, field: string }) {
  const held = shallowRef<{ iri: string, change: RemoteFieldChange } | undefined>()
  const editor = {
    iri: () => iri,
    field: () => field,
    value: (resource: Record<string, unknown>) => resource[field],
    hasLocalChange: () => false,
    hasUnsentChange: () => false,
    localPatch: () => undefined,
    discardLocal: vi.fn(),
    adopt: vi.fn(),
    submit: vi.fn().mockResolvedValue(undefined),
    conflict: vi.fn((next?: { iri: string, change: RemoteFieldChange }) => {
      held.value = next
    }),
    ...overrides,
  } as unknown as ModelEditor & { discardLocal: ReturnType<typeof vi.fn>, submit: ReturnType<typeof vi.fn>, adopt: ReturnType<typeof vi.fn> }
  return { editor, held }
}

describe('RemoteChanges: another admin\'s saved drafts reach a signed-in admin (#429)', () => {
  let store: CwaResourcesStoreInterface
  let cwa: ReturnType<typeof buildCwa>
  let remote: RemoteChanges
  const unregister: (() => unknown)[] = []

  function stored(iri: string) {
    return store.current.byId[iri]?.data
  }

  function seed(resource: Record<string, unknown> & { '@id': string }) {
    store.saveResource({ resource: resource as never })
    store.resetCurrentResources([...store.current.currentIds, resource['@id']])
  }

  function editorOn(overrides: Parameters<typeof fakeEditor>[0]) {
    const created = fakeEditor(overrides)
    unregister.push(registerModelEditor(cwa.$cwa, created.editor))
    return created
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    store = new ResourcesStore('test').useStore()
    cwa = buildCwa()
    remote = new RemoteChanges(cwa.$cwa, store)
    cloneMode.source.value = undefined
    vi.clearAllMocks()
  })

  afterEach(() => {
    unregister.splice(0).forEach(fn => fn())
    vi.unstubAllGlobals()
  })

  describe('the client id', () => {
    test('connect() sends this tab\'s client id on writes, and disconnect() stops it', () => {
      remote.connect()
      expect(cwa.mocks.cwaFetch.writeHeaders[CLIENT_ID_HEADER]).toBe(remote.clientId)
      expect(remote.clientId).toMatch(/\S{8,}/)

      remote.disconnect()
      expect(cwa.mocks.cwaFetch.writeHeaders).not.toHaveProperty(CLIENT_ID_HEADER)
    })

    test('without crypto.randomUUID (an insecure context) the id is still a v4 UUID, which the bundle requires', () => {
      const { getRandomValues } = globalThis.crypto
      vi.stubGlobal('crypto', { getRandomValues: getRandomValues.bind(globalThis.crypto) })
      const v4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

      const ids = [buildCwa(), buildCwa(), buildCwa()].map(({ $cwa }) => new RemoteChanges($cwa, store).clientId)

      ids.forEach(id => expect(id).toMatch(v4))
      expect(new Set(ids).size).toBe(3)
    })

    test('the id is kept per Cwa instance, so each tab has its own', () => {
      expect(new RemoteChanges(cwa.$cwa, store).clientId).toBe(remote.clientId)
      expect(new RemoteChanges(buildCwa().$cwa, store).clientId).not.toBe(remote.clientId)
    })

    test('an update carrying this tab\'s client id is its own save coming back', () => {
      expect(remote.isOwnEcho({ '@id': DRAFT, '@type': 'Title', '_metadata': { lastWrite: { clientId: remote.clientId, userId: '/_/users/1' } } })).toBe(true)
      expect(remote.isOwnEcho({ '@id': DRAFT, '@type': 'Title', '_metadata': { lastWrite: { clientId: 'other-tab', userId: '/_/users/1' } } })).toBe(false)
      expect(remote.isOwnEcho({ '@id': DRAFT, '@type': 'Title' })).toBe(false)
    })
  })

  describe('a resource nobody here is editing', () => {
    test('is applied straight to the store, with nothing left for the outdated notice', async () => {
      seed({ '@id': DRAFT, '@type': 'Title', 'title': 'old' })

      await remote.receive({ '@id': DRAFT, '@type': 'Title', 'title': 'new' }, '/page')

      expect(stored(DRAFT)?.title).toBe('new')
      expect(store.new.allIds).toStrictEqual([])
    })

    test('onRemoteChange hears it on the draft or its published IRI, with the fields that changed and who saved it', async () => {
      seed({ '@id': DRAFT, '@type': 'Title', 'title': 'old', 'publishedResource': LIVE, '_metadata': { publishable: { published: false } } })
      const onDraft = vi.fn()
      const onLive = vi.fn()
      unregister.push(subscribeToRemoteChanges(cwa.$cwa, () => DRAFT, onDraft))
      unregister.push(subscribeToRemoteChanges(cwa.$cwa, () => LIVE, onLive))
      const resource = { '@id': DRAFT, '@type': 'Title', 'title': 'new', 'publishedResource': LIVE, '_metadata': { publishable: { published: false }, lastWrite: { clientId: 'other-tab', userId: '/_/users/2' } } }

      await remote.receive(resource, '/page')

      expect(onDraft).toHaveBeenCalledOnce()
      expect(onDraft).toHaveBeenCalledWith(expect.objectContaining({ resource, user: { id: '/_/users/2', isSelf: false }, changedFields: ['title'] }))
      expect(onLive).toHaveBeenCalledOnce()
    })

    test('a handler removed by its unsubscribe is not called', async () => {
      seed({ '@id': DRAFT, '@type': 'Title', 'title': 'old' })
      const handler = vi.fn()
      subscribeToRemoteChanges(cwa.$cwa, () => DRAFT, handler)()

      await remote.receive({ '@id': DRAFT, '@type': 'Title', 'title': 'new' }, '/page')

      expect(handler).not.toHaveBeenCalled()
    })

    test('a re-fetch that changed nothing does not call onRemoteChange', async () => {
      seed({ '@id': DRAFT, '@type': 'Title', 'title': 'old' })
      const handler = vi.fn()
      unregister.push(subscribeToRemoteChanges(cwa.$cwa, () => DRAFT, handler))

      await remote.receive({ '@id': DRAFT, '@type': 'Title', 'title': 'old', '_metadata': { lastWrite: { clientId: 'other-tab', userId: '/_/users/2' } } }, '/page')

      expect(handler).not.toHaveBeenCalled()
    })

    test('this tab\'s own save coming back through a re-fetch does not call onRemoteChange, and is stored', async () => {
      seed({ '@id': DRAFT, '@type': 'Title', 'title': 'old' })
      const handler = vi.fn()
      unregister.push(subscribeToRemoteChanges(cwa.$cwa, () => DRAFT, handler))

      await remote.receive({ '@id': DRAFT, '@type': 'Title', 'title': 'mine', '_metadata': { lastWrite: { clientId: remote.clientId, userId: '/_/users/1' } } }, '/page')

      expect(handler).not.toHaveBeenCalled()
      expect(stored(DRAFT)?.title).toBe('mine')
    })
  })

  describe('a field changed here and remotely', () => {
    const theirs = { '@id': DRAFT, '@type': 'Title', 'title': 'theirs', 'subtitle': 'their subtitle', '_metadata': { lastWrite: { clientId: 'other-tab', userId: '/_/users/2' } } }

    beforeEach(() => {
      seed({ '@id': DRAFT, '@type': 'Title', 'title': 'old', 'subtitle': 'old subtitle' })
    })

    test('keeps the local field, applies the others and raises the conflict on the model, with no outdated notice', async () => {
      const { editor, held } = editorOn({ iri: DRAFT, field: 'title', hasUnsentChange: () => true })

      await remote.receive(theirs, '/page')

      expect(stored(DRAFT)?.title).toBe('old')
      expect(stored(DRAFT)?.subtitle).toBe('their subtitle')
      expect(store.hasNewResources).toBe(false)
      expect(editor.conflict).toHaveBeenCalledOnce()
      expect(held.value?.iri).toBe(DRAFT)
      expect(held.value?.change).toMatchObject({ value: 'theirs', user: { id: '/_/users/2' } })
    })

    test.each([
      { name: 'a writer who is a known peer is named', peer: true, writer: '/_/users/2', user: { id: '/_/users/2', name: 'Sam', isSelf: false }, shown: 'Sam' },
      { name: 'a writer who is not a known peer has no name', peer: false, writer: '/_/users/2', user: { id: '/_/users/2', isSelf: false }, shown: 'Someone' },
      { name: 'this admin writing from another window is marked as self', peer: false, writer: '/_/users/1', user: { id: '/_/users/1', isSelf: true }, shown: 'You (other window)' },
    ])('$name in the conflict', async ({ peer, writer, user, shown }) => {
      const presence = new Presence(cwa.$cwa, store, { currentRoute: computed(() => ({ path: '/', meta: {} })) } as unknown as Router, remote.clientId)
      presence.start(true)
      peer && presence.receive({ '@type': 'CwaRealtimeEvent', 'v': 1, 'clientId': '7f1e2d3c-4b5a-4c6d-8e7f-9a0b1c2d3e4f', 'user': { id: '/_/users/2', name: 'Sam' }, 'event': 'presence', 'data': { v: 1, state: 'viewing', page: '/_/pages/home' }, 'sentAt': '2026-10-21T10:00:01Z', 'expiresAt': '2026-10-21T10:00:46Z' })
      const { held } = editorOn({ iri: DRAFT, field: 'title', hasUnsentChange: () => true })

      await remote.receive({ ...theirs, _metadata: { lastWrite: { clientId: 'other-tab', userId: writer } } }, '/page')
      presence.stop()

      expect(held.value?.change.user).toStrictEqual(user)
      expect(held.value?.change.name).toBe(shown)
    })

    test('a change to the held field alone still stores its version, so Keep mine is sent against it (api-components-bundle#561)', async () => {
      store.saveResource({ resource: { ...stored(DRAFT)!, _metadata: { version: 2 } } as never })
      editorOn({ iri: DRAFT, field: 'title', hasUnsentChange: () => true })

      await remote.receive({ '@id': DRAFT, '@type': 'Title', 'title': 'theirs', 'subtitle': 'old subtitle', '_metadata': { version: 3, lastWrite: { clientId: 'other-tab', userId: '/_/users/2' } } }, '/page')

      expect(stored(DRAFT)?.title).toBe('old')
      expect(stored(DRAFT)?._metadata?.version).toBe(3)
    })

    test('another admin\'s new draft is stored as on screen, with the path it was fetched for, so it is re-fetched on reconnect', async () => {
      const NEW_DRAFT = '/component/titles/new-draft'

      await remote.receive({ '@id': NEW_DRAFT, '@type': 'Title', 'title': 'theirs', 'publishedResource': DRAFT, '_metadata': { version: 1, lastWrite: { clientId: 'other-tab', userId: '/_/users/2' } } }, '/page')

      expect(store.current.currentIds).toContain(NEW_DRAFT)
      expect(store.current.byId[NEW_DRAFT]?.apiState.headers?.path).toBe('/page')
    })

    test('a save already sent, with nothing typed since, is no conflict: the later write settles it', async () => {
      const { editor } = editorOn({ iri: DRAFT, field: 'title', hasLocalChange: () => true })

      await remote.receive(theirs, '/page')

      expect(editor.conflict).not.toHaveBeenCalled()
      expect(stored(DRAFT)?.title).toBe('theirs')
    })

    test('accept() after this tab\'s own earlier save landed sends their value as a save rather than only showing it', async () => {
      const { editor, held } = editorOn({ iri: DRAFT, field: 'title', hasUnsentChange: () => true })
      await remote.receive(theirs, '/page')
      store.saveResource({ resource: { ...stored(DRAFT)!, title: 'mine, saved' } })

      held.value!.change.accept()

      expect(editor.adopt).toHaveBeenCalledWith('theirs')
      expect(stored(DRAFT)?.title).toBe('mine, saved')
      expect(held.value).toBeUndefined()
    })

    test('this tab\'s own save coming back through a re-fetch is stored and raises no conflict', async () => {
      const { editor } = editorOn({ iri: DRAFT, field: 'title', hasUnsentChange: () => true })

      await remote.receive({ ...theirs, title: 'mine', _metadata: { lastWrite: { clientId: remote.clientId, userId: '/_/users/1' } } }, '/page')

      expect(editor.conflict).not.toHaveBeenCalled()
      expect(stored(DRAFT)?.title).toBe('mine')
    })

    test('a local change to another field is no conflict', async () => {
      const { editor } = editorOn({ iri: DRAFT, field: 'heading', hasUnsentChange: () => true })

      await remote.receive(theirs, '/page')

      expect(editor.conflict).not.toHaveBeenCalled()
      expect(stored(DRAFT)?.title).toBe('theirs')
    })

    test('a newer remote change that no longer touches the field clears its conflict and sends the save it held', async () => {
      const { editor, held } = editorOn({ iri: DRAFT, field: 'title', hasUnsentChange: () => true })
      await remote.receive(theirs, '/page')
      expect(editor.submit).not.toHaveBeenCalled()

      await remote.receive({ ...theirs, title: 'old' }, '/page')

      expect(held.value).toBeUndefined()
      expect(store.new.allIds).toStrictEqual([])
      expect(editor.submit).toHaveBeenCalledOnce()
    })

    test('a newer remote change that still conflicts holds the save again rather than sending it', async () => {
      const { editor, held } = editorOn({ iri: DRAFT, field: 'title', hasUnsentChange: () => true })
      await remote.receive(theirs, '/page')

      await remote.receive({ ...theirs, title: 'theirs again' }, '/page')

      expect(held.value?.change.value).toBe('theirs again')
      expect(editor.submit).not.toHaveBeenCalled()
    })

    test('a cleared conflict whose change has since been sent sends nothing more', async () => {
      let unsent = true
      const { editor } = editorOn({ iri: DRAFT, field: 'title', hasUnsentChange: () => unsent })
      await remote.receive(theirs, '/page')
      unsent = false

      await remote.receive({ ...theirs, title: 'old' }, '/page')

      expect(editor.submit).not.toHaveBeenCalled()
    })

    test('accept() drops the local edit and its waiting save, takes their value without sending a save, and is spent', async () => {
      const { editor, held } = editorOn({ iri: DRAFT, field: 'title', hasUnsentChange: () => true })
      await remote.receive(theirs, '/page')
      const change = held.value!.change

      change.accept()

      expect(editor.discardLocal).toHaveBeenCalledOnce()
      expect(editor.adopt).not.toHaveBeenCalled()
      expect(stored(DRAFT)?.title).toBe('theirs')
      expect(store.new.allIds).toStrictEqual([])
      expect(held.value).toBeUndefined()
      expect(cwa.mocks.resourcesManager.updateResource).not.toHaveBeenCalled()

      change.accept()
      expect(editor.discardLocal).toHaveBeenCalledOnce()
    })

    test('keep() discards their value for the field and lets the local save go', async () => {
      const { editor, held } = editorOn({ iri: DRAFT, field: 'title', hasUnsentChange: () => true })
      await remote.receive(theirs, '/page')

      held.value!.change.keep()

      expect(editor.submit).toHaveBeenCalledOnce()
      expect(editor.discardLocal).not.toHaveBeenCalled()
      expect(stored(DRAFT)?.title).toBe('old')
      expect(store.new.allIds).toStrictEqual([])
      expect(held.value).toBeUndefined()
    })

    test('with two conflicting fields, resolving one keeps the other held', async () => {
      const title = editorOn({ iri: DRAFT, field: 'title', hasUnsentChange: () => true })
      const subtitle = editorOn({ iri: DRAFT, field: 'subtitle', hasUnsentChange: () => true })
      await remote.receive(theirs, '/page')

      title.held.value!.change.accept()

      expect(stored(DRAFT)?.title).toBe('theirs')
      expect(stored(DRAFT)?.subtitle).toBe('old subtitle')
      expect(subtitle.held.value?.change.value).toBe('their subtitle')

      await subtitle.held.value!.change.keep()
      expect(subtitle.editor.submit).toHaveBeenCalledOnce()
      expect(stored(DRAFT)?.subtitle).toBe('old subtitle')
    })

    test('a newer remote change makes the older accept() a no-op', async () => {
      const { editor, held } = editorOn({ iri: DRAFT, field: 'title', hasUnsentChange: () => true })
      await remote.receive(theirs, '/page')
      const older = held.value!.change
      await remote.receive({ ...theirs, title: 'theirs again' }, '/page')

      older.accept()

      expect(editor.discardLocal).not.toHaveBeenCalled()
      expect(held.value?.change.value).toBe('theirs again')
    })

    test('onRemoteChange gets the conflicting fields and its accept() takes the whole remote resource', async () => {
      const { editor } = editorOn({ iri: DRAFT, field: 'title', hasUnsentChange: () => true })
      const handler = vi.fn()
      unregister.push(subscribeToRemoteChanges(cwa.$cwa, () => DRAFT, handler))
      await remote.receive(theirs, '/page')

      expect(handler.mock.calls[0]![0].changedFields).toStrictEqual(['title', 'subtitle'])
      handler.mock.calls[0]![0].accept()

      expect(editor.discardLocal).toHaveBeenCalledOnce()
      expect(stored(DRAFT)?.title).toBe('theirs')
      expect(store.new.allIds).toStrictEqual([])
    })
    test('onRemoteChange\'s accept() from an older change does nothing once a newer one arrived', async () => {
      const { editor } = editorOn({ iri: DRAFT, field: 'title', hasUnsentChange: () => true })
      const handler = vi.fn()
      unregister.push(subscribeToRemoteChanges(cwa.$cwa, () => DRAFT, handler))
      await remote.receive(theirs, '/page')
      await remote.receive({ ...theirs, title: 'theirs again' }, '/page')

      handler.mock.calls[0]![0].accept()

      expect(editor.discardLocal).not.toHaveBeenCalled()
      expect(stored(DRAFT)?.title).toBe('old')
    })
  })

  describe('draft and published are one resource for the conflict check', () => {
    const theirDraft = { '@id': DRAFT, '@type': 'Title', 'title': 'theirs', 'subtitle': 'live subtitle', 'publishedResource': LIVE, '_metadata': { publishable: { published: false }, lastWrite: { clientId: 'other-tab', userId: '/_/users/2' } } }

    beforeEach(() => {
      seed({ '@id': LIVE, '@type': 'Title', 'title': 'live', 'subtitle': 'live subtitle', '_metadata': { publishable: { published: true } } })
    })

    test('another admin\'s new draft conflicts with an unsent change made here on its published IRI', async () => {
      const { editor, held } = editorOn({ iri: LIVE, field: 'title', hasUnsentChange: () => true })

      await remote.receive(theirDraft, '/page')

      expect(held.value?.iri).toBe(LIVE)
      expect(held.value?.change).toMatchObject({ value: 'theirs', user: { id: '/_/users/2' } })
      expect(stored(DRAFT)?.title).toBe('theirs')
      expect(stored(LIVE)?.title).toBe('live')

      await held.value!.change.keep()
      expect(editor.submit).toHaveBeenCalledOnce()
    })

    test('use theirs drops the local change on the published IRI and leaves the published resource as it was', async () => {
      const { editor, held } = editorOn({ iri: LIVE, field: 'title', hasUnsentChange: () => true })
      await remote.receive(theirDraft, '/page')

      held.value!.change.accept()

      expect(editor.discardLocal).toHaveBeenCalledOnce()
      expect(editor.adopt).not.toHaveBeenCalled()
      expect(stored(LIVE)?.title).toBe('live')
      expect(held.value).toBeUndefined()
    })

    test('a field the new draft did not change is no conflict for the published IRI\'s editor', async () => {
      const { editor } = editorOn({ iri: LIVE, field: 'subtitle', hasUnsentChange: () => true })

      await remote.receive(theirDraft, '/page')

      expect(editor.conflict).not.toHaveBeenCalled()
    })
  })

  test('a group change waits for the group\'s queued writes', async () => {
    seed({ '@id': GROUP, '@type': 'ComponentGroup', 'componentPositions': ['/_/component_positions/a'] })
    let finishWrite!: () => void
    cwa.mocks.resourcesManager.queueComponentGroupWrite(GROUP, () => new Promise<void>((resolve) => {
      finishWrite = resolve
    }))

    const received = remote.receive({ '@id': GROUP, '@type': 'ComponentGroup', 'componentPositions': ['/_/component_positions/b'] }, '/page')
    await Promise.resolve()
    expect(stored(GROUP)?.componentPositions).toStrictEqual(['/_/component_positions/a'])

    finishWrite()
    await received
    expect(stored(GROUP)?.componentPositions).toStrictEqual(['/_/component_positions/b'])
  })

  test('a group change never joins the group\'s write queue, so it never makes this tab look as if it were editing the group', async () => {
    seed({ '@id': GROUP, '@type': 'ComponentGroup', 'componentPositions': ['/_/component_positions/a'] })

    const received = remote.receive({ '@id': GROUP, '@type': 'ComponentGroup', 'componentPositions': ['/_/component_positions/b'] }, '/page')
    expect(cwa.$cwa.resourcesManager.isUpdating(GROUP)).toBe(false)
    await received

    expect(stored(GROUP)?.componentPositions).toStrictEqual(['/_/component_positions/b'])
    expect(cwa.$cwa.resourcesManager.isUpdating(GROUP)).toBe(false)
  })

  test('a group change is dropped when this tab\'s group write stored a newer copy while it waited', async () => {
    const a = '/_/component_positions/a'
    const x = '/_/component_positions/x'
    const y = '/_/component_positions/y'
    seed({ '@id': GROUP, '@type': 'ComponentGroup', 'componentPositions': [a, x] })
    let finishWrite!: () => void
    cwa.mocks.resourcesManager.queueComponentGroupWrite(GROUP, () => new Promise<void>((resolve) => {
      finishWrite = () => {
        store.saveResource({ resource: { '@id': GROUP, '@type': 'ComponentGroup', 'componentPositions': [a, x, y] } })
        resolve()
      }
    }))

    const received = remote.receive({ '@id': GROUP, '@type': 'ComponentGroup', 'componentPositions': [a, x] }, '/page')
    await Promise.resolve()
    finishWrite()
    await received

    expect(stored(GROUP)?.componentPositions).toStrictEqual([a, x, y])
  })

  describe('a remote delete', () => {
    test('of a resource in the selection deselects it with a notice', async () => {
      seed({ '@id': DRAFT, '@type': 'Title', 'title': 'old' })
      cwa.stack.value = [{ iri: DRAFT }, { iri: '/_/component_positions/p' }]

      await remote.receive({ '@id': DRAFT }, '/page')

      expect(stored(DRAFT)).toBeUndefined()
      expect(cwa.mocks.admin.emptyStack).toHaveBeenCalledOnce()
      expect(cwa.mocks.resourcesManager.addError).toHaveBeenCalledWith(expect.objectContaining({ detail: 'The component you had selected was removed by someone else.' }))
    })

    test('of the draft shown for a selected published component deselects it', async () => {
      seed({ '@id': DRAFT, '@type': 'Title', 'title': 'old' })
      cwa.stack.value = [{ iri: LIVE }]
      cwa.shownVersion.value = DRAFT

      await remote.receive({ '@id': DRAFT }, '/page')

      expect(cwa.mocks.admin.emptyStack).toHaveBeenCalledOnce()
    })

    test.each([
      { source: { iri: DRAFT }, detail: 'The component being cloned was removed by someone else.' },
      { source: { iri: LIVE, move: { positionIri: DRAFT } }, detail: 'The component being moved was removed by someone else.' },
    ])('of the clone or move source ends the mode with a notice', async ({ source, detail }) => {
      seed({ '@id': DRAFT, '@type': 'Title', 'title': 'old' })
      cloneMode.source.value = source

      await remote.receive({ '@id': DRAFT }, '/page')

      expect(cloneMode.end).toHaveBeenCalledOnce()
      expect(cwa.mocks.resourcesManager.addError).toHaveBeenCalledWith(expect.objectContaining({ detail }))
    })

    test('of a draft edited here, after a publish, moves the unsaved edits onto a new draft of the live resource', async () => {
      seed({ '@id': LIVE, '@type': 'Title', 'title': 'live', 'draftResource': DRAFT, '_metadata': { publishable: { published: true } } })
      seed({ '@id': DRAFT, '@type': 'Title', 'title': 'old', 'publishedResource': LIVE, '_metadata': { publishable: { published: false } } })
      const { editor } = editorOn({ iri: DRAFT, field: 'title', hasLocalChange: () => true, localPatch: () => 'mine' })
      cwa.stack.value = [{ iri: DRAFT }]

      await remote.receive({ '@id': DRAFT }, '/page')

      expect(editor.discardLocal).toHaveBeenCalledOnce()
      expect(stored(DRAFT)).toBeUndefined()
      expect(cwa.mocks.resourcesManager.updateResource).toHaveBeenCalledWith({ endpoint: `${LIVE}?published=false`, data: { title: 'mine' } })
      expect(cwa.mocks.resourcesManager.addError).toHaveBeenCalledWith(expect.objectContaining({ detail: 'The draft you were editing was removed by someone else. Your unsaved changes were saved to a new draft.' }))
    })

    test('of a draft published elsewhere, after the live update the bundle sends first, still moves the unsaved edits onto a new draft', async () => {
      seed({ '@id': LIVE, '@type': 'Title', 'title': 'live', 'draftResource': DRAFT, '_metadata': { publishable: { published: true } } })
      seed({ '@id': DRAFT, '@type': 'Title', 'title': 'saved', 'publishedResource': LIVE, '_metadata': { publishable: { published: false } } })
      const { editor } = editorOn({ iri: DRAFT, field: 'title', hasLocalChange: () => true, hasUnsentChange: () => true, localPatch: () => 'mine' })

      await remote.receive({ '@id': LIVE, '@type': 'Title', 'title': 'saved', '_metadata': { publishable: { published: true }, lastWrite: { clientId: 'other-tab', userId: '/_/users/2' } } }, '/page')
      await remote.receive({ '@id': DRAFT }, '/page')

      expect(editor.conflict).not.toHaveBeenCalledWith(expect.objectContaining({ change: expect.anything() }))
      expect(cwa.mocks.resourcesManager.updateResource).toHaveBeenCalledWith({ endpoint: `${LIVE}?published=false`, data: { title: 'mine' } })
      expect(cwa.mocks.resourcesManager.addError).toHaveBeenCalledWith(expect.objectContaining({ detail: 'The draft you were editing was removed by someone else. Your unsaved changes were saved to a new draft.' }))
    })

    test('of a draft clears a conflict its live resource\'s update raised on the draft\'s editor', async () => {
      seed({ '@id': LIVE, '@type': 'Title', 'title': 'live', 'draftResource': DRAFT, '_metadata': { publishable: { published: true } } })
      seed({ '@id': DRAFT, '@type': 'Title', 'title': 'saved', 'publishedResource': LIVE, '_metadata': { publishable: { published: false } } })
      const { held } = editorOn({ iri: DRAFT, field: 'title', hasLocalChange: () => true, hasUnsentChange: () => true, localPatch: () => 'mine' })
      await remote.receive({ '@id': LIVE, '@type': 'Title', 'title': 'theirs', 'draftResource': DRAFT, '_metadata': { publishable: { published: true }, lastWrite: { clientId: 'other-tab', userId: '/_/users/2' } } }, '/page')
      expect(held.value?.iri).toBe(DRAFT)

      await remote.receive({ '@id': DRAFT }, '/page')

      expect(held.value).toBeUndefined()
    })

    test('of a component edited here with no live version says the unsaved edits are lost', async () => {
      seed({ '@id': DRAFT, '@type': 'Title', 'title': 'old' })
      const { editor } = editorOn({ iri: DRAFT, field: 'title', hasLocalChange: () => true, localPatch: () => 'mine' })

      await remote.receive({ '@id': DRAFT }, '/page')

      expect(editor.discardLocal).toHaveBeenCalledOnce()
      expect(cwa.mocks.resourcesManager.updateResource).not.toHaveBeenCalled()
      expect(cwa.mocks.resourcesManager.addError).toHaveBeenCalledWith(expect.objectContaining({ detail: 'The component you were editing was removed by someone else. Your unsaved changes could not be saved.' }))
    })

    test('of anything else only removes it', async () => {
      seed({ '@id': DRAFT, '@type': 'Title', 'title': 'old' })
      cwa.stack.value = [{ iri: '/component/titles/other' }]

      await remote.receive({ '@id': DRAFT }, '/page')

      expect(stored(DRAFT)).toBeUndefined()
      expect(cwa.mocks.admin.emptyStack).not.toHaveBeenCalled()
      expect(cwa.mocks.resourcesManager.addError).not.toHaveBeenCalled()
    })
  })
})
