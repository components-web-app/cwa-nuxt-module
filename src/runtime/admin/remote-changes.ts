import type Cwa from '#cwa/cwa'
import type { CwaResourcesStoreInterface } from '#cwa/storage/stores/resources/resources-store'
import type { CwaResource } from '#cwa/resources/resource-utils'
import { CwaResourceTypes, getResourceTypeFromIri } from '#cwa/resources/resource-utils'
import { modelEditors } from '#cwa/resources/model-editors'
import type { ModelEditor, RemoteFieldChange, RemoteUser } from '#cwa/resources/model-editors'
import { useCloneMode } from '#cwa/admin/clone-mode'
import { ErrorType } from '#cwa/storage/stores/error/state'

export const CLIENT_ID_HEADER = 'X-CWA-Client-Id'

export interface RemoteChangeEvent {
  resource: CwaResource
  user?: RemoteUser
  changedFields: string[]
  accept: () => void
}

export type RemoteChangeHandler = (event: RemoteChangeEvent) => void

interface Subscription {
  iri: () => string | undefined
  handler: RemoteChangeHandler
}

interface RealtimeState {
  clientId: string
  subscriptions: Set<Subscription>
}

interface Conflict {
  iri: string
  remote: CwaResource
  stored: unknown
}

const IGNORED_FIELDS = ['@id', '@context', '_metadata']

const states = new WeakMap<Cwa, RealtimeState>()

function createClientId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function realtimeState($cwa: Cwa): RealtimeState {
  let state = states.get($cwa)
  if (!state) {
    state = { clientId: createClientId(), subscriptions: new Set() }
    states.set($cwa, state)
  }
  return state
}

export function subscribeToRemoteChanges($cwa: Cwa, iri: () => string | undefined, handler: RemoteChangeHandler) {
  const subscription = { iri, handler }
  const { subscriptions } = realtimeState($cwa)
  subscriptions.add(subscription)
  return () => {
    subscriptions.delete(subscription)
  }
}

function isSame(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function changedFieldsOf(current: CwaResource | undefined, remote: CwaResource) {
  const fields = new Set([...Object.keys(current ?? {}), ...Object.keys(remote)])
  return [...fields].filter(field => !IGNORED_FIELDS.includes(field) && !isSame(current?.[field], remote[field]))
}

function userOf(resource: CwaResource): RemoteUser | undefined {
  const userId = resource._metadata?.lastWrite?.userId
  return userId ? { id: userId } : undefined
}

export class RemoteChanges {
  private readonly conflicts = new Map<ModelEditor, Conflict>()
  private readonly latest = new Map<string, CwaResource>()

  constructor(private readonly $cwa: Cwa, private readonly store: CwaResourcesStoreInterface) {}

  public get clientId() {
    return realtimeState(this.$cwa).clientId
  }

  public connect() {
    this.writeHeaders[CLIENT_ID_HEADER] = this.clientId
  }

  public disconnect() {
    delete this.writeHeaders[CLIENT_ID_HEADER]
  }

  public isOwnEcho(resource: CwaResource) {
    return resource._metadata?.lastWrite?.clientId === this.clientId
  }

  public receive(resource: CwaResource, path: string | undefined): Promise<void> {
    const iri = resource['@id']
    if (Object.keys(resource).length === 1) {
      return this.removed(iri, resource, path)
    }
    if (getResourceTypeFromIri(iri) === CwaResourceTypes.COMPONENT_GROUP) {
      const stored = this.stored(iri)
      return this.$cwa.resourcesManager.queueComponentGroupWrite(iri, async () => {
        this.stored(iri) === stored && this.apply(resource, path)
      })
    }
    this.apply(resource, path)
    return Promise.resolve()
  }

  private get writeHeaders(): Record<string, string> {
    return this.$cwa['cwaFetch'].writeHeaders
  }

  private stored(iri: string | undefined): CwaResource | undefined {
    return iri ? this.store.current.byId[iri]?.data : undefined
  }

  private sameResource(iri: string, resource?: CwaResource) {
    const links = [resource?.publishedResource, resource?.draftResource].filter((link): link is string => typeof link === 'string')
    return [...new Set([...this.store.findAllPublishableIris(iri), ...links])]
  }

  private editorsOf(iri: string, resource?: CwaResource) {
    const iris = this.sameResource(iri, resource)
    return modelEditors(this.$cwa).filter((editor) => {
      const editorIri = editor.iri()
      return !!editorIri && iris.includes(editorIri)
    })
  }

  private saveInPlace(resource: CwaResource, path: string | undefined) {
    this.store.saveResource({ resource, path, isNew: true })
    this.store.mergeNewResource(resource['@id'])
  }

  private apply(resource: CwaResource, path: string | undefined) {
    const iri = resource['@id']
    if (this.isOwnEcho(resource)) {
      this.saveInPlace(resource, path)
      return
    }
    const current = this.stored(iri)
    const changedFields = changedFieldsOf(current ?? this.stored(resource.publishedResource), resource)
    const user = userOf(resource)
    const conflicting = this.editorsOf(iri, resource).filter((editor) => {
      const field = editor.field()
      const editorStored = this.stored(editor.iri())
      return editor.hasUnsentChange() && !!editorStored && !isSame(editorStored[field], resource[field])
    })
    const held = conflicting.filter(editor => editor.iri() === iri)

    this.latest.set(iri, resource)
    this.clearConflicts(iri)
    const kept = Object.fromEntries(held.map(editor => [editor.field(), current?.[editor.field()]]))
    this.saveInPlace({ ...resource, ...kept }, path)
    conflicting.forEach(editor => this.raise(editor, iri, resource, user))

    if (!changedFields.length) {
      return
    }
    const iris = this.sameResource(iri, resource)
    for (const { iri: subscribed, handler } of realtimeState(this.$cwa).subscriptions) {
      const subscribedIri = subscribed()
      if (subscribedIri && (iris.includes(subscribedIri) || this.sameResource(subscribedIri).includes(iri))) {
        handler({ resource, user, changedFields, accept: () => this.acceptAll(iri, resource) })
      }
    }
  }

  private raise(editor: ModelEditor, iri: string, remote: CwaResource, user: RemoteUser | undefined) {
    const editorIri = editor.iri()!
    const conflict: Conflict = { iri, remote, stored: this.stored(editorIri)?.[editor.field()] }
    const change: RemoteFieldChange = {
      user,
      value: editor.value(remote),
      accept: () => {
        this.resolve(editor, conflict, true)
      },
      keep: () => this.resolve(editor, conflict, false),
    }
    this.conflicts.set(editor, conflict)
    editor.conflict({ iri: editorIri, change })
  }

  private clearConflicts(iri: string, onEditorsOfIri = false) {
    for (const [editor, conflict] of this.conflicts) {
      if (conflict.iri === iri || (onEditorsOfIri && editor.iri() === iri)) {
        this.conflicts.delete(editor)
        editor.conflict(undefined)
      }
    }
  }

  private async resolve(editor: ModelEditor, conflict: Conflict, accept: boolean): Promise<void> {
    if (this.conflicts.get(editor) !== conflict) {
      return
    }
    this.conflicts.delete(editor)
    editor.conflict(undefined)

    if (!accept) {
      return editor.submit()
    }
    const { iri, remote } = conflict
    const field = editor.field()
    const current = this.stored(editor.iri())
    if (current && !isSame(current[field], conflict.stored)) {
      editor.adopt(editor.value(remote))
      return
    }
    editor.discardLocal()
    editor.iri() === iri && current && this.store.saveResource({ resource: { ...current, [field]: remote[field] } })
  }

  private acceptAll(iri: string, remote: CwaResource) {
    if (this.latest.get(iri) !== remote) {
      return
    }
    for (const [editor, conflict] of this.conflicts) {
      if (conflict.iri === iri) {
        this.resolve(editor, conflict, true)
      }
    }
  }

  private async removed(iri: string, resource: CwaResource, path: string | undefined) {
    const liveIri = this.stored(iri)?.publishedResource
    const hasLive = typeof liveIri === 'string' && !!this.stored(liveIri)
    const unsaved = modelEditors(this.$cwa).filter(editor => editor.iri() === iri && editor.hasLocalChange())
    const patch = Object.fromEntries(unsaved.map(editor => [editor.field(), editor.localPatch()]))
    unsaved.forEach((editor) => {
      editor.discardLocal()
    })
    this.latest.delete(iri)
    this.clearConflicts(iri, true)

    const stackManager = this.$cwa.admin.resourceStackManager
    const selected = stackManager.currentIri.value === iri || stackManager.resourceStack.value.some(item => item.iri === iri)
    const cloneMode = useCloneMode(this.$cwa)
    const cloneSource = cloneMode.source.value
    const isCloneSource = !!cloneSource && (cloneSource.iri === iri || cloneSource.move?.positionIri === iri)

    this.store.saveResource({ resource, path, isNew: true })
    this.store.mergeNewResource(iri)

    selected && this.$cwa.admin.emptyStack()
    isCloneSource && cloneMode.end()

    const what = hasLive ? 'draft' : 'component'
    let detail: string | undefined
    if (unsaved.length) {
      const saved = hasLive && !!await this.$cwa.resourcesManager.updateResource({ endpoint: `${liveIri}?published=false`, data: patch })
      detail = `The ${what} you were editing was removed by someone else. Your unsaved changes ${saved ? 'were saved to a new draft' : 'could not be saved'}.`
    }
    else if (isCloneSource) {
      detail = `The component being ${cloneSource.move ? 'moved' : 'cloned'} was removed by someone else.`
    }
    else if (selected) {
      detail = `The ${what} you had selected was removed by someone else.`
    }
    detail && this.$cwa.resourcesManager.addError({
      type: ErrorType.SERVER,
      statusCode: 404,
      detail,
      violations: [],
      timestamp: Date.now(),
    })
  }
}
