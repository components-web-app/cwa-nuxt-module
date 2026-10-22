import type Cwa from '#cwa/cwa'
import type { CwaResource } from '#cwa/resources/resource-utils'
import type { FocusedPeer } from '#cwa/admin/presence'

export interface RemoteUser {
  id: string
  name?: string
  isSelf: boolean
}

export interface RemoteFieldChange<T = unknown> {
  user?: RemoteUser
  name: string
  value: T
  accept: () => void
  keep: () => Promise<void>
}

export interface ResourceModelField<T = unknown> {
  model: { value: T | null | undefined }
  remoteChange: { readonly value: RemoteFieldChange<T> | undefined }
  focusedBy?: { readonly value: FocusedPeer[] }
  focusListeners?: {
    onFocusin: () => void
    onFocusout: (event: FocusEvent) => void
    onPointerdown: (event: PointerEvent) => void
  }
}

export interface ModelEditor {
  iri: () => string | undefined
  field: () => string
  value: (resource: CwaResource) => unknown
  hasLocalChange: () => boolean
  hasUnsentChange: () => boolean
  localPatch: () => unknown
  discardLocal: () => void
  adopt: (value: unknown) => void
  moveTo: (from: string, to: string) => void
  submit: () => Promise<void>
  conflict: (held?: { iri: string, change: RemoteFieldChange }) => void
}

const editors = new WeakMap<Cwa, Set<ModelEditor>>()

export function registerModelEditor($cwa: Cwa, editor: ModelEditor) {
  let registered = editors.get($cwa)
  if (!registered) {
    registered = new Set()
    editors.set($cwa, registered)
  }
  registered.add(editor)
  return () => registered.delete(editor)
}

export function modelEditors($cwa: Cwa): ModelEditor[] {
  return [...(editors.get($cwa) ?? [])]
}
