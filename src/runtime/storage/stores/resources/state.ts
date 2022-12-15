import { reactive } from 'vue'
import { CwaResourceErrorObject } from '../../../errors/cwa-resource-error'

export interface CwaResourceApiState {
  status: -1|0|1|null
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
      byId: reactive({}),
      allIds: [],
      currentIds: []
    }),
    new: reactive({
      byId: reactive({}),
      allIds: []
    })
  }
}
