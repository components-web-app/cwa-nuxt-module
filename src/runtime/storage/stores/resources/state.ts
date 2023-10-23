import { reactive } from 'vue'
import type { CwaResourceErrorObject } from '../../../errors/cwa-resource-error'
import type { CwaFetchRequestHeaders } from '../../../api/fetcher/fetcher'
import type { CwaResource } from '../../../resources/resource-utils'

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
  error?: CwaResourceErrorObject
}

export interface CwaResourceApiStateSuccess extends SsrApiState {
  status: CwaResourceApiStatuses.SUCCESS,
  headers: CwaFetchRequestHeaders
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
}

export default function (): CwaResourcesStateInterface {
  return {
    current: reactive({
      byId: {},
      allIds: [],
      currentIds: [],
      publishableMapping: []
    }),
    new: reactive({
      byId: {},
      allIds: []
    })
  }
}
