import { reactive } from 'vue'

export interface CwaResourceApiState {
  status: number|null
  fetchError?: {
    statusCode?: number
    statusText?: string
    statusMessage?: string
    path?: string
    error?: string
  }
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
