export interface CwaResourceErrorObject {
  message?: string
  statusCode?: number
  statusMessage?: string
  statusText?: string
  primaryMessage: string
}

export class CwaResourceError extends Error {
  name = 'CwaResourceError' as const
  statusCode?: number
  statusMessage?: string
  statusText?: string
  asObject?: CwaResourceErrorObject
  primaryMessage?: string
}

export function createCwaResourceError (error: any) {
  const cwaResourceError = new CwaResourceError(error?.message || 'An unknown error occurred')
  Object.defineProperty(cwaResourceError, 'statusCode', { get () { return error?.statusCode } })
  Object.defineProperty(cwaResourceError, 'statusMessage', { get () { return error?.statusMessage } })
  Object.defineProperty(cwaResourceError, 'statusText', { get () { return error?.statusText } })
  Object.defineProperty(cwaResourceError, 'primaryMessage', { get () { return error?.statusText || error?.statusMessage || error.message } })
  Object.defineProperty(cwaResourceError, 'asObject', {
    get (): CwaResourceErrorObject {
      return {
        message: this.message,
        statusCode: this.statusCode,
        statusMessage: this.statusMessage,
        statusText: this.statusText,
        primaryMessage: this.primaryMessage
      }
    }
  })
  return cwaResourceError
}
