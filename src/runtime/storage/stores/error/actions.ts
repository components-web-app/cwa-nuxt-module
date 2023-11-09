import type { FetchError } from 'ofetch'
import type { ApiResourceEvent } from '../../../resources/resources-manager'
import type { CwaErrorStateInterface, CwaErrorEvent } from './state'
import { ErrorType } from './state'

export interface CwaErrorActionsInterface {
  error(event: ApiResourceEvent, error: FetchError): void
}

function getErrorType (type: string): ErrorType {
  switch (type) {
    case 'hydra:Error':
      return ErrorType.SERVER
    case 'TypeError':
      return ErrorType.NETWORK
    case 'ConstraintViolationList':
      return ErrorType.VALIDATION
    default:
      return ErrorType.UNKNOWN
  }
}

export default function (errorState: CwaErrorStateInterface): CwaErrorActionsInterface {
  return {
    error (event: ApiResourceEvent, error: FetchError) {
      const id = errorState.lastErrorId === null ? 0 : errorState.lastErrorId++
      const err: Partial<CwaErrorEvent> = { event, statusCode: error.statusCode, timestamp: new Date() }

      if (error.cause) {
        err.type = getErrorType(error.cause.constructor.name)
        err.detail = (error.cause as Error).message
      } else if (error.data?.['hydra:description']) {
        err.type = getErrorType(error.data['@type'])
        // TODO: use `detail` once we have the problem+json?
        err.detail = error.data['hydra:description']
        err.violations = error.data.violations?.map((e: any) => ({ property: e.propertyPath, message: e.message }))
      } else {
        err.type = ErrorType.SERVER
        err.detail = error.data
      }

      errorState.lastErrorId = id
      errorState.byId[id] = err as CwaErrorEvent
      errorState.allIds.push(id)
    }
  }
}
