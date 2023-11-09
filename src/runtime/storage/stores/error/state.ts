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
    timestamp: Date
}

export interface CwaErrorStateInterface {
  byId: {
    [key: number]: CwaErrorEvent
  },
  lastErrorId: number|null
  allIds: Array<number>
}

export default function (): CwaErrorStateInterface {
  return reactive({
    byId: {},
    lastErrorId: null,
    allIds: []
  })
}
