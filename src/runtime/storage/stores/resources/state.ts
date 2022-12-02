import { FetchError } from 'ohmyfetch'
import { reactive } from '#imports'

export interface CwaResourcesStateInterface {
  current: {
    byId: {
      [key: string]: {
        data: any
        apiRequest?: {
          pending: boolean
          error?: FetchError
        }
      }
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
  return reactive({
    current: {
      byId: {},
      allIds: [],
      currentIds: []
    },
    new: {
      byId: {},
      allIds: []
    }
  })
}
