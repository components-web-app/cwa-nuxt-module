import { reactive } from 'vue'
import { CwaResourceErrorObject } from '../../../errors/cwa-resource-error'
import { CwaFetchRequestHeaders } from '@cwa/nuxt-module/runtime/api/fetcher/fetcher'

export enum CwaResourceApiStatuses {
  ERROR = -1,
  IN_PROGRESS = 0,
  SUCCESS = 1
}

export interface CwaResourceApiStateGeneral {
  status: CwaResourceApiStatuses.IN_PROGRESS|undefined,
  headers?: CwaFetchRequestHeaders
}

export interface CwaResourceApiStateError {
  status: CwaResourceApiStatuses.ERROR,
  error?: CwaResourceErrorObject
}

export interface CwaResourceApiStateSuccess {
  status: CwaResourceApiStatuses.SUCCESS,
  headers: CwaFetchRequestHeaders
}

declare type CwaResourceApiState = CwaResourceApiStateGeneral|CwaResourceApiStateError|CwaResourceApiStateSuccess

export interface CwaCurrentResourceInterface {
  data?: any
  apiState: CwaResourceApiState
}

export interface CwaResourcesStateInterface {
  current: {
    byId: {
      [key: string]: CwaCurrentResourceInterface
    },
    allIds: Array<string>
    currentIds: Array<string>
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
      currentIds: []
    }),
    new: reactive({
      byId: {},
      allIds: []
    })
  }
}
