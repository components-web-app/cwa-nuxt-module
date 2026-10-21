// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, shallowRef } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { ResourcesStore } from '../storage/stores/resources/resources-store'
import type { CwaResourcesStoreInterface } from '../storage/stores/resources/resources-store'
import type { ModelEditor, RemoteFieldChange } from '../resources/model-editors'
import { registerModelEditor } from '../resources/model-editors'
import { CLIENT_ID_HEADER, RemoteChanges, subscribeToRemoteChanges } from './remote-changes'
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
  const groupWrites: Promise<unknown>[] = []
  const $cwa = {
    cwaFetch: { writeHeaders: {} as Record<string, string> },
    admin: {
      resourceStackManager: { resourceStack: stack, currentIri },
      emptyStack: vi.fn(() => {
        stack.value = []
      }),
    },
    resourcesManager: {
      queueComponentGroupWrite: vi.fn((_iri: string, write: () => Promise<unknown>) => {
        const next = (groupWrites.at(-1) ?? Promise.resolve()).then(write)
        groupWrites.push(next)
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
    focused: () => false,
    localPatch: () => undefined,
    discardLocal: vi.fn(),
    submit: vi.fn().mockResolvedValue(undefined),
    conflict: vi.fn((next?: { iri: string, change: RemoteFieldChange }) => {
      held.value = next
    }),
    ...overrides,
  } as unknown as ModelEditor & { discardLocal: ReturnType<typeof vi.fn>, submit: ReturnType<typeof vi.fn> }
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
  })

  describe('the client id', () => {
    test('connect() sends this tab\'s client id on writes, and disconnect() stops it', () => {
      remote.connect()
      expect(cwa.mocks.cwaFetch.writeHeaders[CLIENT_ID_HEADER]).toBe(remote.clientId)
      expect(remote.clientId).toMatch(/\S{8,}/)

      remote.disconnect()
      expect(cwa.mocks.cwaFetch.writeHeaders).not.toHaveProperty(CLIENT_ID_HEADER)
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
      expect(onDraft).toHaveBeenCalledWith(expect.objectContaining({ resource, user: { id: '/_/users/2' }, changedFields: ['title'] }))
      expect(onLive).toHaveBeenCalledOnce()
    })

    test('a handler removed by its unsubscribe is not called', async () => {
      seed({ '@id': DRAFT, '@type': 'Title', 'title': 'old' })
      const handler = vi.fn()
      subscribeToRemoteChanges(cwa.$cwa, () => DRAFT, handler)()

      await remote.receive({ '@id': DRAFT, '@type': 'Title', 'title': 'new' }, '/page')

      expect(handler).not.toHaveBeenCalled()
    })

    test('a field focused here but not changed still takes the remote value', async () => {
      seed({ '@id': DRAFT, '@type': 'Title', 'title': 'old' })
      const { editor } = editorOn({ iri: DRAFT, field: 'title', focused: () => true })

      await remote.receive({ '@id': DRAFT, '@type': 'Title', 'title': 'new' }, '/page')

      expect(stored(DRAFT)?.title).toBe('new')
      expect(editor.conflict).not.toHaveBeenCalled()
    })
  })

  describe('a field changed here and remotely', () => {
    const theirs = { '@id': DRAFT, '@type': 'Title', 'title': 'theirs', 'subtitle': 'their subtitle', '_metadata': { lastWrite: { clientId: 'other-tab', userId: '/_/users/2' } } }

    beforeEach(() => {
      seed({ '@id': DRAFT, '@type': 'Title', 'title': 'old', 'subtitle': 'old subtitle' })
    })

    test('keeps the local field, applies the others, holds the remote resource and raises the conflict on the model', async () => {
      const { editor, held } = editorOn({ iri: DRAFT, field: 'title', hasLocalChange: () => true })

      await remote.receive(theirs, '/page')

      expect(stored(DRAFT)?.title).toBe('old')
      expect(stored(DRAFT)?.subtitle).toBe('their subtitle')
      expect(store.new.byId[DRAFT]?.resource).toEqual(theirs)
      expect(editor.conflict).toHaveBeenCalledOnce()
      expect(held.value?.iri).toBe(DRAFT)
      expect(held.value?.change).toMatchObject({ value: 'theirs', user: { id: '/_/users/2' } })
    })

    test('a local change to another field is no conflict', async () => {
      const { editor } = editorOn({ iri: DRAFT, field: 'heading', hasLocalChange: () => true })

      await remote.receive(theirs, '/page')

      expect(editor.conflict).not.toHaveBeenCalled()
      expect(stored(DRAFT)?.title).toBe('theirs')
    })

    test('a newer remote change that no longer touches the field clears its conflict', async () => {
      const { held } = editorOn({ iri: DRAFT, field: 'title', hasLocalChange: () => true })
      await remote.receive(theirs, '/page')

      await remote.receive({ ...theirs, title: 'old' }, '/page')

      expect(held.value).toBeUndefined()
      expect(store.new.allIds).toStrictEqual([])
    })

    test('accept() drops the local edit and its waiting save, takes their value without sending a save, and is spent', async () => {
      const { editor, held } = editorOn({ iri: DRAFT, field: 'title', hasLocalChange: () => true })
      await remote.receive(theirs, '/page')
      const change = held.value!.change

      change.accept()

      expect(editor.discardLocal).toHaveBeenCalledOnce()
      expect(stored(DRAFT)?.title).toBe('theirs')
      expect(store.new.allIds).toStrictEqual([])
      expect(held.value).toBeUndefined()
      expect(cwa.mocks.resourcesManager.updateResource).not.toHaveBeenCalled()

      change.accept()
      expect(editor.discardLocal).toHaveBeenCalledOnce()
    })

    test('keep() discards their value for the field and lets the local save go', async () => {
      const { editor, held } = editorOn({ iri: DRAFT, field: 'title', hasLocalChange: () => true })
      await remote.receive(theirs, '/page')

      held.value!.change.keep()

      expect(editor.submit).toHaveBeenCalledOnce()
      expect(editor.discardLocal).not.toHaveBeenCalled()
      expect(stored(DRAFT)?.title).toBe('old')
      expect(store.new.allIds).toStrictEqual([])
      expect(held.value).toBeUndefined()
    })

    test('with two conflicting fields, resolving one keeps the other held', async () => {
      const title = editorOn({ iri: DRAFT, field: 'title', hasLocalChange: () => true })
      const subtitle = editorOn({ iri: DRAFT, field: 'subtitle', hasLocalChange: () => true })
      await remote.receive(theirs, '/page')

      title.held.value!.change.accept()

      expect(stored(DRAFT)?.title).toBe('theirs')
      expect(stored(DRAFT)?.subtitle).toBe('old subtitle')
      expect(store.new.byId[DRAFT]?.resource.subtitle).toBe('their subtitle')

      subtitle.held.value!.change.keep()
      expect(store.new.allIds).toStrictEqual([])
    })

    test('a newer remote change makes the older accept() a no-op', async () => {
      const { editor, held } = editorOn({ iri: DRAFT, field: 'title', hasLocalChange: () => true })
      await remote.receive(theirs, '/page')
      const older = held.value!.change
      await remote.receive({ ...theirs, title: 'theirs again' }, '/page')

      older.accept()

      expect(editor.discardLocal).not.toHaveBeenCalled()
      expect(held.value?.change.value).toBe('theirs again')
    })

    test('onRemoteChange gets the conflicting fields and its accept() takes the whole remote resource', async () => {
      const { editor } = editorOn({ iri: DRAFT, field: 'title', hasLocalChange: () => true })
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
      const { editor } = editorOn({ iri: DRAFT, field: 'title', hasLocalChange: () => true })
      const handler = vi.fn()
      unregister.push(subscribeToRemoteChanges(cwa.$cwa, () => DRAFT, handler))
      await remote.receive(theirs, '/page')
      await remote.receive({ ...theirs, title: 'theirs again' }, '/page')

      handler.mock.calls[0]![0].accept()

      expect(editor.discardLocal).not.toHaveBeenCalled()
      expect(stored(DRAFT)?.title).toBe('old')
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
