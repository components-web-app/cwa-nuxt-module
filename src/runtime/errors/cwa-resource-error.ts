export interface CwaResourceErrorObject {
  message?: string
  statusCode?: number
}

export class CwaResourceError extends Error {
  name = 'CwaResourceError' as const
  statusCode?: number
  asObject?: CwaResourceErrorObject
}

export function createCwaResourceError (error: any) {
  const cwaResourceError = new CwaResourceError(error?.message || 'An unknown error occurred')
  Object.defineProperty(cwaResourceError, 'statusCode', { get () { return error?.statusCode } })
  Object.defineProperty(cwaResourceError, 'asObject', { get (): CwaResourceErrorObject { return { message: this.message, statusCode: this.statusCode } } })
  return cwaResourceError
}
