import { reactive } from 'vue'

export interface CwaResourceError {
  statusCode?: number
  message?: string
}

export interface CwaResourceApiState {
  status: -1|0|1|null
  error?: CwaResourceError
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
