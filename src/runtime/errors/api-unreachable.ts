import type { CwaResourceError } from './cwa-resource-error'

const API_DOWN_STATUS_CODES = [502, 503, 504]

export function isApiUnreachable(error?: CwaResourceError): boolean {
  if (!error) {
    return false
  }
  if (error.statusCode === undefined) {
    return !!error.request
  }
  return API_DOWN_STATUS_CODES.includes(error.statusCode)
}
