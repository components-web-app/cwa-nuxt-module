import type { FetchError } from 'ofetch'
import type { ApiResourceEvent } from '../../../resources/resources-manager'
import type { CwaErrorEvent, CwaErrorStateInterface } from './state'
import { ErrorType } from './state'

export interface CwaErrorActionsInterface {
  error(event: ApiResourceEvent, error: FetchError): void
  manual (error: CwaErrorEvent): void
  clear(): void
  removeById(id: number): void
  removeByEndpoint(endpoint: string): void
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
    // use endpoint to make error be replace
    error (event: ApiResourceEvent, error: FetchError) {
      const id = new Date().getTime()
      const err: Partial<CwaErrorEvent> = { event, timestamp: id }

      if (error.cause) {
        err.type = getErrorType(error.cause.constructor.name)
        err.detail = (error.cause as Error).message
      } else if (error.data?.['hydra:description']) {
        err.type = getErrorType(error.data['@type'])
        // todo: hydra:description deprecated in favour of error.data.detail
        err.detail = error.data['hydra:description']
        err.violations = error.data.violations?.map((e: any) => ({ property: e.propertyPath, message: e.message }))
      } else {
        err.type = ErrorType.SERVER
        err.detail = error.data
      }

      if (err.type === ErrorType.SERVER || err.type === ErrorType.VALIDATION || err.type === ErrorType.UNKNOWN) {
        err.statusCode = error.statusCode
      }

      errorState.byId[id] = err as CwaErrorEvent
      errorState.allIds.push(id)
      errorState.allEndpoints.set(event.endpoint, id)
    },
    manual (error: CwaErrorEvent) {
      const id = error.timestamp
      errorState.byId[id] = error
      errorState.allIds.push(id)
      errorState.allEndpoints.set('unset', id)
    },
    clear () {
      errorState.allIds = []
      errorState.allEndpoints.clear()
      errorState.byId = {}
    },
    removeById (id: number) {
      const err = errorState.byId[id]
      if (!err) {
        return
      }

      delete errorState.byId[id]
      errorState.allIds.splice(errorState.allIds.indexOf(id), 1)
      const endpoint = err.event?.endpoint || 'local'
      if (endpoint) {
        errorState.allEndpoints.delete(endpoint)
      }
    },
    removeByEndpoint (endpoint: string) {
      if (!errorState.allEndpoints.has(endpoint)) {
        return
      }

      const id = errorState.allEndpoints.get(endpoint)
      id && this.removeById(id)
    }
  }
}
