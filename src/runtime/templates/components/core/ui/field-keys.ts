import type { InjectionKey, Ref } from 'vue'

export interface ManagerTabContext {
  iri: Ref<string | undefined>
  register: (field: string) => void
}

export type Announce = (message: string) => void

export const managerTabKey: InjectionKey<ManagerTabContext> = Symbol('cwa-manager-tab')
export const tabMetaOnlyKey = 'cwaTabMetaOnly'
export const tabFieldsKey: InjectionKey<string[]> = Symbol('cwa-tab-fields')
export const announceKey: InjectionKey<Announce> = Symbol('cwa-announce')
