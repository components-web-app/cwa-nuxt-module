import type { ResourceModelField } from '#cwa/resources/model-editors'

export interface DialogFieldConflict {
  name: string
  value: unknown
}

export interface DialogForm {
  unsavedFields: string[]
  fieldErrors: Record<string, string>
  conflicts: Record<string, DialogFieldConflict>
  formError?: string
  saving: boolean
  savedAt?: number
  failures: number
  model: <T = unknown>(field: string) => ResourceModelField<T>
  discard: () => void
}

export interface DialogTab {
  key: string
  label: string
  disabled?: string
}

export interface TabBadge {
  kind: 'conflict' | 'error' | 'unsaved' | undefined
  conflicts: number
  errors: number
  unsaved: number
}

export function dialogTabBadge(fields: string[], form: Pick<DialogForm, 'unsavedFields' | 'fieldErrors' | 'conflicts'> | undefined): TabBadge {
  const conflicts = fields.filter(field => !!form?.conflicts[field]).length
  const errors = fields.filter(field => !!form?.fieldErrors[field]).length
  const unsaved = fields.filter(field => !!form?.unsavedFields.includes(field)).length
  return { kind: conflicts ? 'conflict' : errors ? 'error' : unsaved ? 'unsaved' : undefined, conflicts, errors, unsaved }
}

export function dialogTabWords({ conflicts, errors, unsaved }: TabBadge) {
  return [
    conflicts ? `${conflicts} to choose` : '',
    errors ? `${errors} to fix` : '',
    unsaved ? `${unsaved} unsaved` : '',
  ].filter(Boolean).join(', ')
}

export function changesText(count: number) {
  return `${count} ${count === 1 ? 'change' : 'changes'}`
}

export function listText(names: string[]) {
  if (names.length < 2) {
    return names[0] ?? ''
  }
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}
