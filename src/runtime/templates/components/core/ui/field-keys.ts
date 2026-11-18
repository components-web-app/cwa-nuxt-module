import type { InjectionKey, Ref } from 'vue'
import type { ResourceModelField } from '#cwa/resources/model-editors'

export interface ManagerTabContext {
  iri: Ref<string | undefined>
  register: (field: string) => void
}

export type Announce = (message: string) => void

export const managerTabKey: InjectionKey<ManagerTabContext> = Symbol('cwa-manager-tab')
export const tabMetaOnlyKey = 'cwaTabMetaOnly'
export const managerTabMountedKey: InjectionKey<(row: HTMLElement) => () => void> = Symbol('cwa-manager-tab-mounted')
export interface PresenceLayer {
  el: Readonly<Ref<HTMLElement | null>>
  align: 'start' | 'end'
}

export const presenceLayerKey: InjectionKey<PresenceLayer> = Symbol('cwa-presence-layer')
export const tabFieldsKey: InjectionKey<string[]> = Symbol('cwa-tab-fields')
export const announceKey: InjectionKey<Announce> = Symbol('cwa-announce')

export interface FieldUndo {
  text: string
  run: () => void
}

export interface FieldGroupContext {
  model: (field: string) => ResourceModelField<any> | undefined
  undo: (field: string) => FieldUndo | undefined
}

export const fieldGroupKey: InjectionKey<FieldGroupContext> = Symbol('cwa-field-group')

export interface EitherOrContext {
  active: Ref<number>
  register: (label: string, fields: string[]) => number
}

export const eitherOrKey: InjectionKey<EitherOrContext> = Symbol('cwa-either-or')

export interface FormSurfaceContext {
  unsaved: (field: string) => boolean
  register: (field: string, label: string) => () => void
}

export const formSurfaceKey: InjectionKey<FormSurfaceContext> = Symbol('cwa-form-surface')

export const sectionHeadingKey: InjectionKey<'h2' | 'h3'> = Symbol('cwa-section-heading')

export interface DialogSubFooter {
  saveLabel: string
  saving: boolean
  disabledReason?: string
  cancel: () => void
  save: () => void
}

export interface DialogSubViewGuard {
  unsaved: () => string[]
  leave: () => void
}

export interface DialogSubViewContext {
  footer: (get: () => DialogSubFooter | 'none' | undefined) => () => void
  guard: (entry: DialogSubViewGuard) => () => void
}

export interface DialogSubViewClaim {
  tab?: string
  footer?: () => DialogSubFooter | 'none' | undefined
  guard?: DialogSubViewGuard
}

export const dialogSubViewKey: InjectionKey<DialogSubViewContext> = Symbol('cwa-dialog-sub-view')
