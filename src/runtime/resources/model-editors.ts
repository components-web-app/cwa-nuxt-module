import type Cwa from '#cwa/cwa'
import type { CwaResource } from '#cwa/resources/resource-utils'

export interface RemoteUser {
  id: string
  name?: string
}

export interface RemoteFieldChange<T = unknown> {
  user?: RemoteUser
  value: T
  accept: () => void
  keep: () => void
}

export interface ResourceModelField<T = unknown> {
  model: { value: T | null | undefined }
  remoteChange: { readonly value: RemoteFieldChange<T> | undefined }
  focus: () => void
  blur: () => void
}

export function writeField<T>(field: ResourceModelField<T>, value: T | null | undefined) {
  field.model.value = value
}

export interface ModelEditor {
  iri: () => string | undefined
  field: () => string
  value: (resource: CwaResource) => unknown
  hasLocalChange: () => boolean
  focused: () => boolean
  localPatch: () => unknown
  discardLocal: () => void
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
