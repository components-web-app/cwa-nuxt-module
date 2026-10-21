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
      return this.$cwa.resourcesManager.queueComponentGroupWrite(iri, async () => this.apply(resource, path))
    }
    this.apply(resource, path)
    return Promise.resolve()
  }

  private get writeHeaders(): Record<string, string> {
    return this.$cwa['cwaFetch'].writeHeaders
  }

  private sameResource(iri: string) {
    return this.store.findAllPublishableIris(iri)
  }

  private editorsOf(iri: string) {
    return modelEditors(this.$cwa).filter(editor => editor.iri() === iri)
  }

  private apply(resource: CwaResource, path: string | undefined) {
    const iri = resource['@id']
    const current = this.store.current.byId[iri]?.data
    const changedFields = changedFieldsOf(current, resource)
    const user = userOf(resource)
    const conflicting = this.editorsOf(iri).filter(editor => editor.hasLocalChange() && changedFields.includes(editor.field()))

    this.latest.set(iri, resource)
    this.clearConflicts(iri)
    if (conflicting.length) {
      const kept = Object.fromEntries(conflicting.map(editor => [editor.field(), current?.[editor.field()]]))
      this.store.saveResource({ resource: { ...resource, ...kept } })
      this.store.saveResource({ resource, path, isNew: true })
      conflicting.forEach(editor => this.raise(editor, iri, resource, user))
    }
    else {
      this.store.saveResource({ resource, path, isNew: true })
      this.store.mergeNewResource(iri)
    }

    const iris = this.sameResource(iri)
    for (const { iri: subscribed, handler } of realtimeState(this.$cwa).subscriptions) {
      const subscribedIri = subscribed()
      if (subscribedIri && (iris.includes(subscribedIri) || this.sameResource(subscribedIri).includes(iri))) {
        handler({ resource, user, changedFields, accept: () => this.acceptAll(iri, resource) })
      }
    }
  }

  private raise(editor: ModelEditor, iri: string, remote: CwaResource, user: RemoteUser | undefined) {
    const conflict: Conflict = { iri, remote }
    const change: RemoteFieldChange = {
      user,
      value: editor.value(remote),
      accept: () => this.resolve(editor, conflict, true),
      keep: () => this.resolve(editor, conflict, false),
    }
    this.conflicts.set(editor, conflict)
    editor.conflict({ iri, change })
  }

  private clearConflicts(iri: string) {
    for (const [editor, conflict] of this.conflicts) {
      if (conflict.iri === iri) {
        this.conflicts.delete(editor)
        editor.conflict(undefined)
      }
    }
  }

  private resolve(editor: ModelEditor, conflict: Conflict, accept: boolean) {
    if (this.conflicts.get(editor) !== conflict) {
      return
    }
    this.conflicts.delete(editor)
    editor.conflict(undefined)

    const { iri, remote } = conflict
    const field = editor.field()
    const heldEntry = this.store.new.byId[iri]
    let held: CwaResource | undefined = heldEntry?.resource
    const current = this.store.current.byId[iri]?.data
    if (accept) {
      editor.discardLocal()
      current && this.store.saveResource({ resource: { ...current, [field]: remote[field] } })
    }
    else {
      held = held && { ...held, [field]: current?.[field] }
      editor.submit()
    }
    this.settleHeld(iri, heldEntry?.path, held)
  }

  private settleHeld(iri: string, path: string | undefined, held: CwaResource | undefined) {
    const current = this.store.current.byId[iri]?.data
    if (!current) {
      return
    }
    if ([...this.conflicts.values()].some(conflict => conflict.iri === iri)) {
      held && this.store.saveResource({ resource: held, path, isNew: true })
      return
    }
    this.store.new.byId[iri] && this.store.saveResource({ resource: current })
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
    const liveIri = this.store.current.publishableMapping.find(mapping => mapping.draftIri === iri)?.publishedIri
    const hasLive = !!liveIri && !!this.store.current.byId[liveIri]
    const unsaved = this.editorsOf(iri).filter(editor => editor.hasLocalChange())
    const patch = Object.fromEntries(unsaved.map(editor => [editor.field(), editor.localPatch()]))
    unsaved.forEach((editor) => {
      editor.discardLocal()
    })
    this.latest.delete(iri)
    this.clearConflicts(iri)

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
