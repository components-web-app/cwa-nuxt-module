import { reactive, type Ref, ref } from 'vue'
import type { CwaResourceErrorObject } from '../../../errors/cwa-resource-error'
import type { CwaFetchRequestHeaders } from '../../../api/fetcher/fetcher'
import type { CwaResource } from '../../../resources/resource-utils'

export const NEW_RESOURCE_IRI = '__new__'

export enum CwaResourceApiStatuses {
  ERROR = -1,
  IN_PROGRESS = 0,
  SUCCESS = 1
}

interface SsrApiState {
  ssr?: boolean
}

export interface CwaResourceApiStateGeneral extends SsrApiState {
  status: CwaResourceApiStatuses.IN_PROGRESS|undefined,
  headers?: CwaFetchRequestHeaders
}

export interface CwaResourceApiStateError extends SsrApiState {
  status: CwaResourceApiStatuses.ERROR,
  error?: CwaResourceErrorObject,
  fetchedAt: number
}

export interface CwaResourceApiStateSuccess extends SsrApiState {
  status: CwaResourceApiStatuses.SUCCESS,
  headers: CwaFetchRequestHeaders,
  fetchedAt: number
}

declare type CwaResourceApiState = CwaResourceApiStateGeneral|CwaResourceApiStateError|CwaResourceApiStateSuccess

export interface CwaCurrentResourceInterface {
  data?: CwaResource
  apiState: CwaResourceApiState
}

interface PublishableMapping {
  draftIri: string
  publishedIri: string
}

export interface CwaResourcesStateInterface {
  current: {
    byId: {
      [key: string]: CwaCurrentResourceInterface
    },
    allIds: Array<string>
    currentIds: Array<string>
    publishableMapping: Array<PublishableMapping>
    positionsByComponent: { [componentIri: string]: string[] }
  }
  new: {
    byId: {
      [key: string]: {
        resource: any,
        path?: string
      }
    },
    allIds: Array<string>
  }
  adding: Ref<CwaResource|undefined>
}

export default function (): CwaResourcesStateInterface {
  return {
    current: reactive({
      byId: {},
      allIds: [],
      currentIds: [],
      publishableMapping: [],
      positionsByComponent: {}
    }),
    new: reactive({
      byId: {},
      allIds: []
    }),
    adding: ref(undefined)
  }
}
