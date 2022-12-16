import { reactive } from 'vue'
import { CwaResourceErrorObject } from '../../../errors/cwa-resource-error'

export enum CwaResourceApiStatuses {
  ERROR = -1,
  IN_PROGRESS = 0,
  SUCCESS = 1
}

export interface CwaResourceApiState {
  status: CwaResourceApiStatuses|undefined
  error?: CwaResourceErrorObject
}

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
      [key: string]: any
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
