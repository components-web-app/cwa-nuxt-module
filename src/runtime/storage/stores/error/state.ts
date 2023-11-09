import { reactive } from 'vue'
// TODO: move this interface?
import type { ApiResourceEvent } from '../../../resources/resources-manager'

export interface CwaViolationError {
  message: string
  propertyPath: string
}

export enum ErrorType {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  SERVER = 'SERVER',
  UNKNOWN = 'UNKNOWN',
}

export interface CwaErrorEvent {
    event: ApiResourceEvent
    statusCode: number|undefined
    type: ErrorType
    detail: string
    violations: CwaViolationError[]
    timestamp: number
}

export interface CwaErrorStateInterface {
  byId: {
    [key: number]: CwaErrorEvent
  },
  allIds: Array<number>,
  allEndpoints: Map<string, number>
}

export default function (): CwaErrorStateInterface {
  return reactive({
    byId: {},
    allIds: [],
    allEndpoints: new Map()
  })
}
