import { reactive } from 'vue'
// TODO: move this interface?
import type { ApiResourceEvent } from '../../../resources/resources-manager'

export interface CwaViolationError {
  message: string
  property: string
}

export enum ErrorType {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  SERVER = 'SERVER',
  UNKNOWN = 'UNKNOWN',
}

interface CwaBaseErrorEvent {
  event?: ApiResourceEvent
  detail: string
  violations: CwaViolationError[]
  timestamp: number
}

interface CwaResolvedErrorEvent extends CwaBaseErrorEvent {
  type: Exclude<ErrorType, ErrorType.NETWORK>
  statusCode: number
}

interface CwaNetworkErrorEvent extends CwaBaseErrorEvent {
  type: ErrorType.NETWORK
  statusCode: undefined
}

export type CwaErrorEvent = CwaNetworkErrorEvent|CwaResolvedErrorEvent

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
